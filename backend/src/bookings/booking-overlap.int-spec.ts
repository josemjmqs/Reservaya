import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const run = Date.now().toString(36);

let businessId: string;
let memberId: string;
let otherMemberId: string;
let serviceId: string;
let customerId: string;
const userIds: string[] = [];

// Cada test usa un día distinto (2030) para no interferir con los demás
const at = (day: number, h: number, m = 0) =>
  new Date(Date.UTC(2030, 0, day, h, m));

const book = (start: Date, end: Date, member = memberId) =>
  prisma.booking.create({
    data: {
      startsAt: start,
      endsAt: end,
      businessId,
      memberId: member,
      serviceId,
      customerId,
    },
  });

beforeAll(async () => {
  const business = await prisma.business.create({
    data: { name: 'Int Test', slug: `int-test-${run}` },
  });
  businessId = business.id;

  const [u1, u2] = await Promise.all(
    [1, 2].map((n) =>
      prisma.user.create({
        data: {
          email: `int-${run}-${n}@test.local`,
          name: `U${n}`,
          password: 'x',
        },
      }),
    ),
  );
  userIds.push(u1.id, u2.id);

  const [m1, m2] = await Promise.all(
    [u1, u2].map((u) =>
      prisma.member.create({
        data: { role: 'STAFF', displayName: u.name, userId: u.id, businessId },
      }),
    ),
  );
  memberId = m1.id;
  otherMemberId = m2.id;

  serviceId = (
    await prisma.service.create({
      data: { name: 'Servicio', durationMin: 30, businessId },
    })
  ).id;
  customerId = (
    await prisma.customer.create({
      data: { name: 'Cliente', email: `c-${run}@test.local`, businessId },
    })
  ).id;
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { businessId } });
  await prisma.customer.deleteMany({ where: { businessId } });
  await prisma.service.deleteMany({ where: { businessId } });
  await prisma.member.deleteMany({ where: { businessId } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.business.delete({ where: { id: businessId } });
  await prisma.$disconnect();
});

const OVERLAP = /booking_no_overlap|23P01|exclusion|40P01|deadlock/i;

describe('restricción anti-solape de reservas', () => {
  it('rechaza una reserva que se solapa parcialmente', async () => {
    await book(at(1, 10), at(1, 10, 30));
    await expect(book(at(1, 10, 15), at(1, 10, 45))).rejects.toThrow(OVERLAP);
  });

  it('permite reservas contiguas (el fin de una es el inicio de otra)', async () => {
    await book(at(2, 10), at(2, 10, 30));
    await expect(book(at(2, 10, 30), at(2, 11))).resolves.toBeDefined();
  });

  it('con 10 peticiones simultáneas a la misma hora, solo una gana', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => book(at(3, 10), at(3, 10, 30))),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(9);
    failed.forEach((f) => expect(String(f.reason)).toMatch(OVERLAP));
  });

  it('una reserva cancelada libera la hora', async () => {
    const first = await book(at(4, 10), at(4, 10, 30));
    await prisma.booking.update({
      where: { id: first.id },
      data: { status: 'CANCELLED' },
    });
    await expect(book(at(4, 10), at(4, 10, 30))).resolves.toBeDefined();
  });

  it('no deja reactivar una cancelada si otra tomó su hora', async () => {
    const first = await book(at(5, 10), at(5, 10, 30));
    await prisma.booking.update({
      where: { id: first.id },
      data: { status: 'CANCELLED' },
    });
    await book(at(5, 10), at(5, 10, 30));
    await expect(
      prisma.booking.update({
        where: { id: first.id },
        data: { status: 'CONFIRMED' },
      }),
    ).rejects.toThrow(OVERLAP);
  });

  it('permite la misma hora para profesionales distintos', async () => {
    await book(at(6, 10), at(6, 10, 30), memberId);
    await expect(
      book(at(6, 10), at(6, 10, 30), otherMemberId),
    ).resolves.toBeDefined();
  });

  it('dos profesionales distintos pueden tomar la misma hora en paralelo', async () => {
    const results = await Promise.allSettled([
      book(at(7, 10), at(7, 10, 30), memberId),
      book(at(7, 10), at(7, 10, 30), otherMemberId),
    ]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('con 2 profesionales y 6 clientes simultáneos a la misma hora, solo 2 ganan', async () => {
    const members = [memberId, otherMemberId];
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        book(at(8, 10), at(8, 10, 30), members[i % 2]),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(ok).toHaveLength(2);
    expect(failed).toHaveLength(4);
    failed.forEach((f) => expect(String(f.reason)).toMatch(OVERLAP));
  }); 
});
