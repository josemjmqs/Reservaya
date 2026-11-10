// Datos de prueba para desarrollo local: un negocio demo con equipo, servicios,
// horarios y reservas alrededor de hoy. Se puede correr varias veces: borra y
// vuelve a crear el negocio demo cada vez.
//
//   npx prisma db seed                 → hoy queda sin reservas
//   SEED_TODAY=1 npx prisma db seed    → también agrega reservas para hoy
//
// Panel: demo@reservahoy.local / demo1234 · página pública: /demo-peluqueria
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { DateTime } from 'luxon';

const SLUG = 'demo-peluqueria';
const EMAIL = 'demo@reservahoy.local';
const PASSWORD = 'demo1234';
const TZ = 'America/Santiago';

// Nunca contra producción: solo bases en este computador
const url = process.env.DATABASE_URL ?? '';
const host = url ? new URL(url).hostname : '';
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
  console.error(
    `Seed cancelado: DATABASE_URL apunta a "${host || '(vacío)'}". Solo se permite una base local.`,
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function reset() {
  const business = await prisma.business.findUnique({ where: { slug: SLUG } });
  if (business) {
    const businessId = business.id;
    await prisma.booking.deleteMany({ where: { businessId } });
    await prisma.customer.deleteMany({ where: { businessId } });
    await prisma.timeBlock.deleteMany({ where: { businessId } });
    await prisma.workingHours.deleteMany({ where: { member: { businessId } } });
    await prisma.member.deleteMany({ where: { businessId } });
    await prisma.service.deleteMany({ where: { businessId } });
    await prisma.business.delete({ where: { id: businessId } });
  }
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (user) {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });
    await prisma.member.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

// El n-ésimo día hábil (lunes a sábado) desde hoy; negativo hacia atrás
function workday(n: number) {
  let day = DateTime.now().setZone(TZ).startOf('day');
  const step = n < 0 ? -1 : 1;
  for (let left = Math.abs(n); left > 0;) {
    day = day.plus({ days: step });
    if (day.weekday !== 7) left--;
  }
  return day;
}

async function main() {
  await reset();

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      name: 'Camila Rojas',
      password: await bcrypt.hash(PASSWORD, 10),
      emailVerifiedAt: new Date(),
    },
  });

  const business = await prisma.business.create({
    data: { name: 'Peluquería Demo', slug: SLUG, phone: '+56 9 1234 5678' },
  });
  const businessId = business.id;

  const camila = await prisma.member.create({
    data: {
      role: 'OWNER',
      displayName: 'Camila',
      userId: user.id,
      businessId,
    },
  });
  const diego = await prisma.member.create({
    data: { role: 'STAFF', displayName: 'Diego', businessId },
  });

  const service = (
    name: string,
    durationMin: number,
    price: number,
    category: string,
    memberIds: string[],
  ) =>
    prisma.service.create({
      data: {
        name,
        durationMin,
        price,
        category,
        businessId,
        members: { create: memberIds.map((memberId) => ({ memberId })) },
      },
    });

  const corte = await service('Corte de pelo', 45, 12000, 'Pelo', [
    camila.id,
    diego.id,
  ]);
  const barba = await service('Perfilado de barba', 30, 8000, 'Barba', [
    camila.id,
    diego.id,
  ]);
  const color = await service('Color completo', 90, 35000, 'Pelo', [camila.id]);
  const lavado = await service('Lavado y peinado', 30, 10000, 'Pelo', [
    camila.id,
  ]);

  // Lunes a viernes 10:00–19:00 y sábado 10:00–14:00 para ambos
  for (const memberId of [camila.id, diego.id]) {
    await prisma.workingHours.createMany({
      data: [1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        opensAt: '10:00',
        closesAt: weekday === 6 ? '14:00' : '19:00',
        memberId,
      })),
    });
  }

  const customers = await Promise.all(
    [
      ['Valentina Muñoz', 'valentina@ejemplo.cl', '+56 9 8765 4321'],
      ['Matías González', 'matias@ejemplo.cl', null],
      ['Fernanda Soto', 'fernanda@ejemplo.cl', '+56 9 5555 1234'],
      ['Benjamín Díaz', 'benjamin@ejemplo.cl', null],
      ['Josefa Pérez', 'josefa@ejemplo.cl', '+56 9 4444 9876'],
    ].map(([name, email, phone]) =>
      prisma.customer.create({ data: { name, email, phone, businessId } }),
    ),
  );

  type Status = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  const book = (
    day: DateTime,
    time: string,
    memberId: string,
    customer: number,
    services: { id: string; durationMin: number }[],
    status: Status = 'CONFIRMED',
  ) => {
    const [hour, minute] = time.split(':').map(Number);
    const start = day.set({ hour, minute });
    const minutes = services.reduce((sum, s) => sum + s.durationMin, 0);
    return prisma.booking.create({
      data: {
        startsAt: start.toJSDate(),
        endsAt: start.plus({ minutes }).toJSDate(),
        status,
        businessId,
        memberId,
        customerId: customers[customer].id,
        items: {
          create: services.map((s, position) => ({
            serviceId: s.id,
            position,
          })),
        },
      },
    });
  };

  const yesterday = workday(-1);
  await book(yesterday, '10:00', camila.id, 0, [corte], 'COMPLETED');
  await book(yesterday, '12:00', diego.id, 1, [barba], 'NO_SHOW');

  if (process.env.SEED_TODAY === '1') {
    const today = DateTime.now().setZone(TZ).startOf('day');
    await book(today, '11:00', camila.id, 2, [corte, lavado]);
    await book(today, '16:30', diego.id, 3, [barba], 'PENDING');
  }

  const next = workday(1);
  await book(next, '10:00', camila.id, 2, [corte, barba]);
  await book(next, '11:00', diego.id, 3, [corte]);
  await book(next, '15:00', camila.id, 4, [color], 'CANCELLED');

  await book(workday(2), '12:00', camila.id, 4, [lavado], 'PENDING');
  await book(workday(4), '11:00', diego.id, 1, [barba]);

  console.log(
    `Negocio demo listo: entra con ${EMAIL} / ${PASSWORD} (página pública: /${SLUG})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
