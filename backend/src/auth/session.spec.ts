import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { SESSION_DAYS, renewSession, shouldRenew } from './session';

const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '30d' } });
const HOUR = 60 * 60 * 1000;
const now = Date.UTC(2026, 10, 13, 12);
const iatHoursAgo = (h: number) => Math.floor((now - h * HOUR) / 1000);

// req con la sesión que deja JwtStrategy y res que solo registra las cookies
const fakeHttp = (iat: number, viaCookie: boolean) => {
  const cookies: { name: string; value: string; options: { maxAge?: number } }[] = [];
  const req = {
    user: { userId: 'u1', email: 'a@b.cl', sv: 3, iat },
    cookies: viaCookie ? { token: 'viejo' } : {},
  } as unknown as Request;
  const res = {
    cookie: (name: string, value: string, options: { maxAge?: number }) =>
      cookies.push({ name, value, options }),
  } as unknown as Response;
  return { req, res, cookies };
};

describe('shouldRenew', () => {
  it('no renueva un token de menos de un día', () => {
    expect(shouldRenew(iatHoursAgo(23), now)).toBe(false);
  });

  it('renueva un token de más de un día', () => {
    expect(shouldRenew(iatHoursAgo(25), now)).toBe(true);
  });
});

describe('renewSession', () => {
  it('con un token de cookie de más de un día pone una cookie nueva por 30 días', async () => {
    const { req, res, cookies } = fakeHttp(iatHoursAgo(30), true);
    await renewSession(req, res, jwt, now);

    expect(cookies).toHaveLength(1);
    expect(cookies[0].name).toBe('token');
    expect(cookies[0].options.maxAge).toBe(SESSION_DAYS * 24 * HOUR);
    const payload = jwt.verify<{ sub: string; email: string; sv: number }>(
      cookies[0].value,
    );
    expect(payload).toMatchObject({ sub: 'u1', email: 'a@b.cl', sv: 3 });
  });

  it('no hace nada si el token es de hoy', async () => {
    const { req, res, cookies } = fakeHttp(iatHoursAgo(2), true);
    await renewSession(req, res, jwt, now);
    expect(cookies).toHaveLength(0);
  });

  it('no hace nada si el token llegó por el header Bearer', async () => {
    const { req, res, cookies } = fakeHttp(iatHoursAgo(30), false);
    await renewSession(req, res, jwt, now);
    expect(cookies).toHaveLength(0);
  });
});
