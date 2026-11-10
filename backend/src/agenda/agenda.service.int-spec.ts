import { NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import type { PrismaService } from '../prisma/prisma.service';
import { AgendaService } from './agenda.service';

// Servicio de Nest real contra PostgreSQL (posible porque Jest corre en ESM)
const prisma = new PrismaClient();
const service = new AgendaService(prisma as unknown as PrismaService);
const run = Date.now().toString(36);
const tz = 'America/Santiago';

let businessId: string;
let otherBusinessId: string;
let ownerUserId: string;
let otherUserId: string;
let memberId: string;
let secondMemberId: string;
let otherMemberId: string;

const local = (date: string, time: string) =>
  DateTime.fromISO(`${date}T${time}`, { zone: tz }).toJSDate();

// "Ahora" fijo para las pruebas: 2032-03-10 a las 12:00
const now = local('2032-03-10', '12:00');

beforeAll(async () => {
  const [b1, b2] = await Promise.all(
    ['a', 'b'].map((x) =>
      prisma.business.create({
        data: { name: `Agenda ${x}`, slug: `int-agenda-${x}-${run}` },
      }),
    ),
  );
  businessId = b1.id;
  otherBusinessId = b2.id;

  const [u1, u2] = await Promise.all(
    ['a', 'b'].map((x) =>
      prisma.user.create({
        data: {
          email: `agenda-${x}-${run}@test.local`,
          name: x,
          password: 'x',
        },
      }),
    ),
  );
  ownerUserId = u1.id;
  otherUserId = u2.id;

  memberId = (
    await prisma.member.create({
      data: { role: 'OWNER', displayName: 'Dueña', userId: u1.id, businessId },
    })
  ).id;
  secondMemberId = (
    await prisma.member.create({
      data: { role: 'STAFF', displayName: 'Ayudante', businessId },
    })
  ).id;
  otherMemberId = (
    await prisma.member.create({
      data: {
        role: 'OWNER',
        displayName: 'Otro',
        userId: u2.id,
        businessId: otherBusinessId,
      },
    })
  ).id;

  const svc = await prisma.service.create({
    data: { name: 'Corte', durationMin: 60, businessId },
  });
  const customer = await prisma.customer.create({
    data: { name: 'C', email: `agenda-c-${run}@test.local`, businessId },
  });

  const book = (
    date: string,
    time: string,
    member: string,
    status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' = 'CONFIRMED',
  ) =>
    prisma.booking.create({
      data: {
        startsAt: local(date, time),
        endsAt: DateTime.fromJSDate(local(date, time))
          .plus({ hours: 1 })
          .toJSDate(),
        status,
        businessId,
        memberId: member,
        customerId: customer.id,
        items: { create: { serviceId: svc.id, position: 0 } },
      },
    });

  await Promise.all([
    book('2032-03-10', '09:00', memberId), // ya pasó
    book('2032-03-11', '10:00', memberId, 'CANCELLED'), // cancelada
    book('2032-03-12', '15:00', memberId), // la próxima de la dueña
    book('2032-03-11', '16:00', secondMemberId), // la próxima del negocio
  ]);
});

afterAll(async () => {
  const ids = [businessId, otherBusinessId];
  await prisma.booking.deleteMany({ where: { businessId: { in: ids } } });
  await prisma.customer.deleteMany({ where: { businessId: { in: ids } } });
  await prisma.service.deleteMany({ where: { businessId: { in: ids } } });
  await prisma.member.deleteMany({ where: { businessId: { in: ids } } });
  await prisma.user.deleteMany({
    where: { id: { in: [ownerUserId, otherUserId] } },
  });
  await prisma.business.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe('AgendaService.next', () => {
  it('devuelve la próxima reserva activa del negocio, ignorando pasadas y canceladas', async () => {
    const { booking } = await service.next(ownerUserId, undefined, now);
    expect(booking?.startsAt).toEqual(local('2032-03-11', '16:00'));
    expect(booking?.member.id).toBe(secondMemberId);
    expect(booking?.services).toEqual([{ name: 'Corte', durationMin: 60 }]);
  });

  it('filtra por profesional', async () => {
    const { booking } = await service.next(ownerUserId, memberId, now);
    expect(booking?.startsAt).toEqual(local('2032-03-12', '15:00'));
  });

  it('responde null si no hay reservas futuras', async () => {
    const later = local('2032-03-13', '00:00');
    expect(await service.next(ownerUserId, undefined, later)).toEqual({
      booking: null,
    });
  });

  it('no deja consultar un profesional de otro negocio', async () => {
    await expect(
      service.next(ownerUserId, otherMemberId, now),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
