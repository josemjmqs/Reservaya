import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import type { PrismaService } from '../prisma/prisma.service';
import { ManageBookingService } from './manage.service';

// Lo que el cliente puede hacer con su enlace privado (/reserva/[token]), sin cuenta
const prisma = new PrismaClient();
const manage = new ManageBookingService(prisma as unknown as PrismaService);
const run = Date.now().toString(36);

let businessId: string;
let memberId: string;
let customerId: string;
let serviceId: string;
let hour = 8;

type Status = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
// Crea una reserva (cada una en su propia hora, para no chocar) y devuelve su token
async function booking(status: Status, when: 'future' | 'past' = 'future') {
  const day = DateTime.now()
    .setZone('America/Santiago')
    .startOf('day')
    .plus({ days: when === 'future' ? 30 : -30 });
  const start = day.set({ hour: hour++ });
  const b = await prisma.booking.create({
    data: {
      startsAt: start.toJSDate(),
      endsAt: start.plus({ minutes: 30 }).toJSDate(),
      status,
      businessId,
      memberId,
      customerId,
      items: { create: { serviceId, position: 0 } },
    },
  });
  return b.manageToken;
}

beforeAll(async () => {
  businessId = (
    await prisma.business.create({
      data: {
        name: 'Taller',
        slug: `int-manage-${run}`,
        phone: '+56 2 2222 2222',
      },
    })
  ).id;
  memberId = (
    await prisma.member.create({
      data: { role: 'OWNER', displayName: 'Ana', businessId },
    })
  ).id;
  serviceId = (
    await prisma.service.create({
      data: { name: 'Cambio de aceite', durationMin: 30, businessId },
    })
  ).id;
  customerId = (
    await prisma.customer.create({
      data: {
        name: 'Cliente',
        email: `manage-${run}@test.local`,
        phone: '+56 9 0000 0000',
        businessId,
      },
    })
  ).id;
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { businessId } });
  await prisma.customer.deleteMany({ where: { businessId } });
  await prisma.service.deleteMany({ where: { businessId } });
  await prisma.member.deleteMany({ where: { businessId } });
  await prisma.business.delete({ where: { id: businessId } });
  await prisma.$disconnect();
});

describe('ManageBookingService', () => {
  it('muestra la reserva con sus servicios y el negocio, sin datos de otros clientes', async () => {
    const view = await manage.get(await booking('CONFIRMED'));
    expect(view.services).toEqual([
      { name: 'Cambio de aceite', durationMin: 30 },
    ]);
    expect(view.business).toEqual({
      name: 'Taller',
      timezone: 'America/Santiago',
      phone: '+56 2 2222 2222',
    });
    expect(view).not.toHaveProperty('customer');
    expect(view).not.toHaveProperty('manageToken');
  });

  it('un enlace inventado responde 404', async () => {
    await expect(manage.get('no-existe')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(manage.cancel('no-existe')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each(['CONFIRMED', 'PENDING'] as const)(
    'cancela una reserva %s futura',
    async (status) => {
      const token = await booking(status);
      expect(await manage.cancel(token)).toEqual({ status: 'CANCELLED' });
      expect((await manage.get(token)).status).toBe('CANCELLED');
    },
  );

  it('no se puede cancelar dos veces', async () => {
    const token = await booking('CONFIRMED');
    await manage.cancel(token);
    await expect(manage.cancel(token)).rejects.toThrow('ya está cancelada');
  });

  it.each(['COMPLETED', 'NO_SHOW'] as const)(
    'una reserva %s ya no se puede cancelar',
    async (status) => {
      await expect(manage.cancel(await booking(status))).rejects.toBeInstanceOf(
        ConflictException,
      );
    },
  );

  it('una reserva que ya pasó no se puede cancelar', async () => {
    await expect(
      manage.cancel(await booking('CONFIRMED', 'past')),
    ).rejects.toThrow('ya pasó');
  });
});
