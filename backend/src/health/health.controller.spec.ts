import { jest } from '@jest/globals'; // en modo ESM, jest no es global
import type { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('/health/live responde sin consultar la base de datos', () => {
    const queryRaw = jest.fn();
    const controller = new HealthController({
      $queryRaw: queryRaw,
    } as unknown as PrismaService);

    expect(controller.live()).toEqual({ status: 'ok' });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('/health sí verifica la base de datos', async () => {
    const queryRaw = jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue([{ '?column?': 1 }]);
    const controller = new HealthController({
      $queryRaw: queryRaw,
    } as unknown as PrismaService);

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});
