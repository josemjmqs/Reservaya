import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { WorkingHoursService } from './working-hours.service';

// Horario semanal contra PostgreSQL
const prisma = new PrismaClient();
const hours = new WorkingHoursService(prisma as unknown as PrismaService);
const run = Date.now().toString(36);

let businessId: string;
let userId: string;
let staffId: string;

const day = (weekday: number, opensAt = '10:00', closesAt = '19:00') => ({
  weekday,
  opensAt,
  closesAt,
});
const summary = (
  rows: { weekday: number; opensAt: string; closesAt: string }[],
) => rows.map((r) => `${r.weekday} ${r.opensAt}-${r.closesAt}`);

beforeAll(async () => {
  businessId = (
    await prisma.business.create({
      data: { name: 'Horarios', slug: `int-hours-${run}` },
    })
  ).id;
  userId = (
    await prisma.user.create({
      data: { email: `hours-${run}@test.local`, name: 'D', password: 'x' },
    })
  ).id;
  await prisma.member.create({
    data: { role: 'OWNER', displayName: 'Dueña', userId, businessId },
  });
  staffId = (
    await prisma.member.create({
      data: { role: 'STAFF', displayName: 'Beto', businessId },
    })
  ).id;
});

afterAll(async () => {
  await prisma.workingHours.deleteMany({ where: { member: { businessId } } });
  await prisma.member.deleteMany({ where: { businessId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.business.delete({ where: { id: businessId } });
  await prisma.$disconnect();
});

describe('WorkingHoursService', () => {
  it('guarda el horario propio ordenado por día', async () => {
    const saved = await hours.replace(userId, {
      days: [day(3), day(1, '09:00', '13:00')],
    });
    expect(summary(saved)).toEqual(['1 09:00-13:00', '3 10:00-19:00']);
  });

  it('guardar reemplaza el horario anterior en vez de sumarle días', async () => {
    await hours.replace(userId, { days: [day(1), day(2), day(3)] });
    const saved = await hours.replace(userId, { days: [day(5)] });
    expect(summary(saved)).toEqual(['5 10:00-19:00']);
  });

  it('una lista vacía deja al profesional sin horario', async () => {
    await hours.replace(userId, { days: [day(1)] });
    expect(await hours.replace(userId, { days: [] })).toEqual([]);
  });

  it('el horario de otro profesional del negocio es independiente', async () => {
    await hours.replace(userId, { days: [day(1)] });
    await hours.replace(userId, {
      memberId: staffId,
      days: [day(6, '10:00', '14:00')],
    });
    expect(summary(await hours.findAll(userId))).toEqual(['1 10:00-19:00']);
    expect(summary(await hours.findAll(userId, staffId))).toEqual([
      '6 10:00-14:00',
    ]);
  });

  it('rechaza días repetidos', async () => {
    await expect(
      hours.replace(userId, { days: [day(1), day(1, '15:00', '18:00')] }),
    ).rejects.toThrow('días repetidos');
  });

  it.each([
    ['cierre antes de la apertura', '18:00', '09:00'],
    ['apertura igual al cierre', '10:00', '10:00'],
  ])('rechaza %s', async (_, opensAt, closesAt) => {
    await expect(
      hours.replace(userId, { days: [day(2, opensAt, closesAt)] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un horario rechazado no borra el que había', async () => {
    await hours.replace(userId, { days: [day(4)] });
    await expect(
      hours.replace(userId, { days: [day(1, '12:00', '11:00')] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(summary(await hours.findAll(userId))).toEqual(['4 10:00-19:00']);
  });
});
