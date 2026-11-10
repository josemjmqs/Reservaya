import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { isTransient, NotificationsService } from './notifications.service';

type Result = {
  error: { name: string; message: string; statusCode: number | null } | null;
};

// Resend simulado: devuelve las respuestas en orden y anota cada llamada
function setup(responses: (Result | Error)[]) {
  const calls: { to: unknown; idempotencyKey?: string }[] = [];
  const service = new NotificationsService({
    get: () => undefined,
  } as unknown as ConfigService);
  Object.assign(service, {
    retryDelaysMs: [0, 0],
    resend: {
      emails: {
        send: (email: { to: unknown }, opts: { idempotencyKey?: string }) => {
          calls.push({ to: email.to, idempotencyKey: opts?.idempotencyKey });
          const next = responses.shift() ?? { error: null };
          return next instanceof Error
            ? Promise.reject(next)
            : Promise.resolve(next);
        },
      },
    },
  });
  return { service, calls };
}

const fail = (name: string, statusCode: number | null = null): Result => ({
  error: { name, message: name, statusCode },
});
const reset = (service: NotificationsService) =>
  service.passwordReset('a@test.local', 'A', 'token');

beforeAll(() => Logger.overrideLogger(false)); // sin ruido de logs en los tests

describe('NotificationsService: reintentos de correo', () => {
  it('reintenta una falla pasajera y usa la misma clave de idempotencia', async () => {
    const { service, calls } = setup([fail('rate_limit_exceeded', 429)]);
    await reset(service);
    expect(calls).toHaveLength(2);
    expect(calls[0].idempotencyKey).toBeTruthy();
    expect(calls[1].idempotencyKey).toBe(calls[0].idempotencyKey);
  });

  it('reintenta si se cae la conexión (excepción) y se rinde tras 3 intentos sin lanzar', async () => {
    const { service, calls } = setup([
      new Error('ECONNRESET'),
      fail('application_error'),
      fail('internal_server_error', 500),
      fail('internal_server_error', 500),
    ]);
    await expect(reset(service)).resolves.toBeUndefined();
    expect(calls).toHaveLength(3);
  });

  it('no reintenta errores definitivos', async () => {
    const { service, calls } = setup([fail('validation_error', 422)]);
    await reset(service);
    expect(calls).toHaveLength(1);
  });

  it('cada correo tiene su propia clave de idempotencia', async () => {
    const { service, calls } = setup([]);
    await reset(service);
    await reset(service);
    expect(calls[0].idempotencyKey).not.toBe(calls[1].idempotencyKey);
  });
});

describe('isTransient', () => {
  it.each([
    ['rate_limit_exceeded', 429, true],
    ['application_error', null, true],
    ['internal_server_error', 500, true],
    ['daily_quota_exceeded', 429, false],
    ['invalid_api_key', 403, false],
    ['validation_error', 422, false],
  ])('%s (%s) → %s', (name, statusCode, expected) => {
    expect(isTransient({ name, message: '', statusCode })).toBe(expected);
  });
});
