import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import { findMemberSlots } from '../availability/member-slots';

const prisma = new PrismaClient();
const run = Date.now().toString(36);
const tz = 'America/Santiago';

let businessId: string;
let memberId: string;
let otherMemberId: string;

// Fechas en 2031 para no chocar con otros tests de integración
const local = (date: string, time = '00:00') =>
  DateTime.fromISO(`${date}T${time}`, { zone: tz });

const slots = (member: string, date: string) => {
  const day = local(date);
  return findMemberSlots(prisma, {
    memberId: member,
    businessId,
    timezone: tz,
    date,
    weekday: day.weekday % 7,
    dayStart: day.startOf('day').toJSDate(),
    dayEnd: day.endOf('day').toJSDate(),
    durationMin: 60,
  });
};

beforeAll(async () => {
  businessId = (
    await prisma.business.create({
      data: { name: 'Int Blocks', slug: `int-blocks-${run}` },
    })
  ).id;

  const [m1, m2] = await Promise.all(
    ['A', 'B'].map((name) =>
      prisma.member.create({
        data: { role: 'STAFF', displayName: name, businessId },
      }),
    ),
  );
  memberId = m1.id;
  otherMemberId = m2.id;

  // Lunes (1) a miércoles (3), de 09:00 a 12:00: tres horas de 60 min
  await prisma.workingHours.createMany({
    data: [m1.id, m2.id].flatMap((id) =>
      [1, 2, 3].map((weekday) => ({
        memberId: id,
        weekday,
        opensAt: '09:00',
        closesAt: '12:00',
      })),
    ),
  });
});

afterAll(async () => {
  await prisma.timeBlock.deleteMany({ where: { businessId } });
  await prisma.workingHours.deleteMany({
    where: { memberId: { in: [memberId, otherMemberId] } },
  });
  await prisma.member.deleteMany({ where: { businessId } });
  await prisma.business.delete({ where: { id: businessId } });
  await prisma.$disconnect();
});

describe('bloqueos de tiempo en la disponibilidad', () => {
  it('sin bloqueos se ofrecen todas las horas', async () => {
    expect(await slots(memberId, '2031-03-10')).toHaveLength(3);
  });

  it('un bloqueo del negocio quita la hora a todos los profesionales', async () => {
    await prisma.timeBlock.create({
      data: {
        businessId,
        startsAt: local('2031-03-11', '10:00').toJSDate(),
        endsAt: local('2031-03-11', '11:00').toJSDate(),
      },
    });
    const ten = local('2031-03-11', '10:00').toUTC().toISO();
    for (const m of [memberId, otherMemberId]) {
      const s = await slots(m, '2031-03-11');
      expect(s).toHaveLength(2);
      expect(s.some((x) => DateTime.fromISO(x).toUTC().toISO() === ten)).toBe(
        false,
      );
    }
  });

  it('un bloqueo de un profesional no afecta a los demás', async () => {
    await prisma.timeBlock.create({
      data: {
        businessId,
        memberId,
        startsAt: local('2031-03-12').toJSDate(),
        endsAt: local('2031-03-13').toJSDate(),
      },
    });
    expect(await slots(memberId, '2031-03-12')).toHaveLength(0);
    expect(await slots(otherMemberId, '2031-03-12')).toHaveLength(3);
  });

  it('un bloqueo de otro negocio no afecta', async () => {
    const other = await prisma.business.create({
      data: { name: 'Otro', slug: `int-blocks-other-${run}` },
    });
    await prisma.timeBlock.create({
      data: {
        businessId: other.id,
        startsAt: local('2031-03-10').toJSDate(),
        endsAt: local('2031-03-11').toJSDate(),
      },
    });
    try {
      expect(await slots(memberId, '2031-03-10')).toHaveLength(3);
    } finally {
      await prisma.timeBlock.deleteMany({ where: { businessId: other.id } });
      await prisma.business.delete({ where: { id: other.id } });
    }
  });
});
