import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import type { AvailabilityService } from '../availability/availability.service';
import type {
  NewBookingEmailData,
  NotificationsService,
} from '../notifications/notifications.service';
import type { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from './bookings.service';

// Aviso por correo de reservas nuevas, contra PostgreSQL y con el correo simulado
const prisma = new PrismaClient();
const sent: NewBookingEmailData[] = [];
const notifications = {
  newBookingForStaff: (data: NewBookingEmailData) => {
    sent.push(data);
    return Promise.resolve();
  },
} as unknown as NotificationsService;
const bookings = new BookingsService(
  prisma as unknown as PrismaService,
  {} as AvailabilityService,
  notifications,
);
const run = Date.now().toString(36);

let businessId: string;
let bookingId: string;
const userIds: string[] = [];

beforeAll(async () => {
  businessId = (
    await prisma.business.create({
      data: { name: 'Barbería Aviso', slug: `int-notify-${run}` },
    })
  ).id;

  const user = (x: string) =>
    prisma.user.create({
      data: { email: `notify-${x}-${run}@test.local`, name: x, password: 'x' },
    });
  const [owner, off, inactive] = await Promise.all(
    ['dueña', 'apagado', 'inactivo'].map(user),
  );
  userIds.push(owner.id, off.id, inactive.id);

  const ownerMember = await prisma.member.create({
    data: { role: 'OWNER', displayName: 'Ana', userId: owner.id, businessId },
  });
  await prisma.member.createMany({
    data: [
      // tiene cuenta pero desactivó los avisos
      {
        role: 'STAFF',
        displayName: 'Beto',
        userId: off.id,
        businessId,
        notifyNewBookings: false,
      },
      // ya no trabaja en el negocio
      {
        role: 'STAFF',
        displayName: 'Caro',
        userId: inactive.id,
        businessId,
        active: false,
      },
      // sin cuenta: no tiene a quién escribirle
      { role: 'STAFF', displayName: 'Dani', businessId },
    ],
  });

  const [corte, barba] = await Promise.all(
    ['Corte', 'Barba'].map((name) =>
      prisma.service.create({ data: { name, durationMin: 30, businessId } }),
    ),
  );
  const customer = await prisma.customer.create({
    data: {
      name: 'Valentina',
      email: `notify-c-${run}@test.local`,
      phone: '+56 9 1111 2222',
      businessId,
    },
  });
  const startsAt = DateTime.fromISO('2033-05-04T10:00', {
    zone: 'America/Santiago',
  });
  bookingId = (
    await prisma.booking.create({
      data: {
        startsAt: startsAt.toJSDate(),
        endsAt: startsAt.plus({ hours: 1 }).toJSDate(),
        notes: 'Llego en bici',
        businessId,
        memberId: ownerMember.id,
        customerId: customer.id,
        items: {
          create: [
            { serviceId: barba.id, position: 1 },
            { serviceId: corte.id, position: 0 },
          ],
        },
      },
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

beforeEach(() => {
  sent.length = 0;
});

describe('BookingsService.notifyStaff', () => {
  it('escribe solo a miembros activos, con cuenta y con los avisos activados', async () => {
    await bookings.notifyStaff(bookingId);
    expect(sent.map((s) => s.recipientName)).toEqual(['dueña']);
  });

  it('incluye los datos de la reserva con los servicios en orden', async () => {
    await bookings.notifyStaff(bookingId);
    expect(sent[0]).toMatchObject({
      to: `notify-dueña-${run}@test.local`,
      businessName: 'Barbería Aviso',
      customerName: 'Valentina',
      customerPhone: '+56 9 1111 2222',
      serviceName: 'Corte + Barba',
      memberName: 'Ana',
      notes: 'Llego en bici',
      timezone: 'America/Santiago',
    });
  });

  it('no escribe a nadie si todos desactivaron los avisos', async () => {
    await prisma.member.updateMany({
      where: { businessId },
      data: { notifyNewBookings: false },
    });
    await bookings.notifyStaff(bookingId);
    expect(sent).toEqual([]);
    await prisma.member.updateMany({
      where: { businessId, displayName: 'Ana' },
      data: { notifyNewBookings: true },
    });
  });

  it('nunca lanza, aunque la reserva no exista', async () => {
    await expect(bookings.notifyStaff('no-existe')).resolves.toBeUndefined();
    expect(sent).toEqual([]);
  });
});
