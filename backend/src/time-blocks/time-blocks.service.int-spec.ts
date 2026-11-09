import { NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import type { PrismaService } from '../prisma/prisma.service';
import { TimeBlocksService } from './time-blocks.service';

// Servicio de Nest real contra PostgreSQL (posible porque Jest corre en ESM)
const prisma = new PrismaClient();
const service = new TimeBlocksService(prisma as unknown as PrismaService);
const run = Date.now().toString(36);
const tz = 'America/Santiago';

let businessId: string;
let otherBusinessId: string;
let ownerUserId: string;
let otherUserId: string;
let memberId: string;
let otherMemberId: string;

const local = (date: string, time = '00:00') =>
  DateTime.fromISO(`${date}T${time}`, { zone: tz }).toJSDate();

beforeAll(async () => {
  const [b1, b2] = await Promise.all(
    ['a', 'b'].map((x) =>
      prisma.business.create({
        data: { name: `Svc ${x}`, slug: `int-svc-${x}-${run}` },
      }),
    ),
  );
  businessId = b1.id;
  otherBusinessId = b2.id;

  const [u1, u2] = await Promise.all(
    ['a', 'b'].map((x) =>
      prisma.user.create({
        data: { email: `svc-${x}-${run}@test.local`, name: x, password: 'x' },
      }),
    ),
  );
  ownerUserId = u1.id;
  otherUserId = u2.id;

  memberId = (
    await prisma.member.create({
      data: {
        role: 'OWNER',
        displayName: 'Dueña',
        userId: u1.id,
        businessId,
      },
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

  // Una reserva activa el 2031-04-15 a las 10:00 para probar el aviso
  const svc = await prisma.service.create({
    data: { name: 'Corte', durationMin: 60, businessId },
  });
  const customer = await prisma.customer.create({
    data: { name: 'C', email: `svc-c-${run}@test.local`, businessId },
  });
  await prisma.booking.create({
    data: {
      startsAt: local('2031-04-15', '10:00'),
      endsAt: local('2031-04-15', '11:00'),
      businessId,
      memberId,
      serviceId: svc.id,
      customerId: customer.id,
    },
  });
});

afterAll(async () => {
  const ids = [businessId, otherBusinessId];
  await prisma.timeBlock.deleteMany({ where: { businessId: { in: ids } } });
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

describe('TimeBlocksService', () => {
  it('crea un bloqueo de día completo y avisa las reservas que choca', async () => {
    const block = await service.create(ownerUserId, {
      startDate: '2031-04-15',
      endDate: '2031-04-15',
      allDay: true,
      reason: '  Feriado  ',
    });
    expect(block.allDay).toBe(true);
    expect(block.reason).toBe('Feriado');
    expect(block.member).toBeNull();
    expect(block.conflicts).toBe(1);
  });

  it('un bloqueo de un profesional devuelve su nombre', async () => {
    const block = await service.create(ownerUserId, {
      startDate: '2031-04-16',
      endDate: '2031-04-16',
      allDay: false,
      startTime: '13:00',
      endTime: '15:00',
      memberId,
    });
    expect(block.member).toEqual({ id: memberId, displayName: 'Dueña' });
    expect(block.conflicts).toBe(0);
  });

  it('lista solo los bloqueos del propio negocio', async () => {
    await service.create(otherUserId, {
      startDate: '2031-04-17',
      endDate: '2031-04-17',
      allDay: true,
    });
    const { timezone, blocks } = await service.list(ownerUserId);
    expect(timezone).toBe(tz);
    expect(blocks).toHaveLength(2);
  });

  it('no permite usar un profesional de otro negocio', async () => {
    await expect(
      service.create(ownerUserId, {
        startDate: '2031-04-18',
        endDate: '2031-04-18',
        allDay: true,
        memberId: otherMemberId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('no permite borrar un bloqueo de otro negocio (404)', async () => {
    const { blocks } = await service.list(otherUserId);
    await expect(
      service.remove(ownerUserId, blocks[0].id),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(otherUserId, blocks[0].id)).resolves.toEqual({
      id: blocks[0].id,
    });
  });
});
