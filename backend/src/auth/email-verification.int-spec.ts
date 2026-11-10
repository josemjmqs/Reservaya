import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { AvailabilityService } from '../availability/availability.service';
import { BookingsService } from '../bookings/bookings.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

// AuthService real contra PostgreSQL; el correo se reemplaza por un registro en memoria
const prisma = new PrismaClient();
const db = prisma as unknown as PrismaService;
const sent: { to: string; token: string }[] = [];
const notifications = {
  emailVerification: (to: string, _name: string, token: string) => {
    sent.push({ to, token });
    return Promise.resolve();
  },
  bookingConfirmed: () => Promise.resolve(),
} as unknown as NotificationsService;

const auth = new AuthService(
  db,
  new JwtService({ secret: 'test-secret' }),
  notifications,
);
const availability = new AvailabilityService(db);
const bookings = new BookingsService(db, availability, notifications);

const run = Date.now().toString(36);
const email = `verify-${run}@test.local`;
const slug = `int-verify-${run}`;
let userId: string;

const lastToken = () => sent.filter((m) => m.to === email).at(-1)!.token;

beforeAll(async () => {
  await auth.register({
    name: 'Dueña',
    email,
    password: 'password123',
    businessName: 'Verificación',
    slug,
  });
  userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
});

afterAll(async () => {
  const business = await prisma.business.findUnique({ where: { slug } });
  if (business) {
    await prisma.member.deleteMany({ where: { businessId: business.id } });
    await prisma.business.delete({ where: { id: business.id } });
  }
  await prisma.user.deleteMany({ where: { email } }); // borra sus tokens en cascada
  await prisma.$disconnect();
});

describe('verificación de correo', () => {
  it('el registro deja la cuenta sin verificar y envía un enlace', async () => {
    expect(sent.filter((m) => m.to === email)).toHaveLength(1);
    expect((await auth.me(userId)).emailVerifiedAt).toBeNull();
  });

  it('guarda solo el hash del token', async () => {
    const token = lastToken();
    const stored = await prisma.emailVerificationToken.findMany({
      where: { userId },
    });
    expect(stored.map((t) => t.tokenHash)).toEqual([
      createHash('sha256').update(token).digest('hex'),
    ]);
  });

  it('un negocio sin verificar no recibe reservas', async () => {
    expect((await availability.getBusiness(slug)).acceptsBookings).toBe(false);
    await expect(
      bookings.create(slug, {
        serviceId: 'x',
        startsAt: new Date().toISOString(),
        name: 'Cliente',
        email: `cliente-${run}@test.local`,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza un token inválido', async () => {
    await expect(auth.verifyEmail('no-existe')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza un token expirado', async () => {
    await prisma.emailVerificationToken.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(auth.verifyEmail(lastToken())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reenviar respeta el máximo de 3 correos por hora', async () => {
    // el del registro cuenta como el primero
    await expect(auth.resendVerification(userId)).resolves.toEqual({
      ok: true,
      alreadyVerified: false,
    });
    await auth.resendVerification(userId);
    await expect(auth.resendVerification(userId)).rejects.toMatchObject({
      status: 429,
    });
  });

  it('un token válido verifica la cuenta y habilita las reservas', async () => {
    const token = lastToken();
    await expect(auth.verifyEmail(token)).resolves.toEqual({ ok: true });
    expect((await auth.me(userId)).emailVerifiedAt).toBeInstanceOf(Date);
    expect((await availability.getBusiness(slug)).acceptsBookings).toBe(true);

    // abrir el enlace de nuevo no es un error, y los demás enlaces quedan usados
    await expect(auth.verifyEmail(token)).resolves.toEqual({ ok: true });
    const pending = await prisma.emailVerificationToken.count({
      where: { userId, usedAt: null },
    });
    expect(pending).toBe(0);
  });

  it('reenviar a una cuenta verificada no envía nada', async () => {
    const before = sent.length;
    await expect(auth.resendVerification(userId)).resolves.toEqual({
      ok: true,
      alreadyVerified: true,
    });
    expect(sent).toHaveLength(before);
  });
});
