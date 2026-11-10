import { NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageService } from '../storage/storage.service';
import { AvailabilityService } from './availability.service';

// La página pública del negocio (GET /public/:slug) la puede ver cualquiera:
// solo debe mostrar lo necesario para reservar
const prisma = new PrismaClient();
const storage = {
  urlFor: (key: string | null) => (key ? `https://img.test/${key}` : null),
} as unknown as StorageService;
const availability = new AvailabilityService(
  prisma as unknown as PrismaService,
  storage,
);
const run = Date.now().toString(36);
const slug = `int-public-${run}`;

let businessId: string;
let userId: string;

beforeAll(async () => {
  businessId = (
    await prisma.business.create({
      data: { name: 'Barbería Pública', slug, phone: '+56 9 1234 5678' },
    })
  ).id;
  userId = (
    await prisma.user.create({
      data: {
        email: `public-${run}@test.local`,
        name: 'D',
        password: 'secreto',
      },
    })
  ).id;
  const corte = await prisma.service.create({
    data: {
      name: 'Corte',
      durationMin: 30,
      price: 10000,
      imageKey: `services/${run}.webp`,
      businessId,
    },
  });
  await prisma.service.create({
    data: { name: 'Antiguo', durationMin: 30, active: false, businessId },
  });
  await prisma.member.create({
    data: {
      role: 'OWNER',
      displayName: 'Dueña',
      userId,
      businessId,
      services: { create: { serviceId: corte.id } },
    },
  });
  await prisma.member.createMany({
    data: [
      { role: 'STAFF', displayName: 'Inactivo', active: false, businessId },
      { role: 'STAFF', displayName: 'Recepción', bookable: false, businessId },
    ],
  });
});

afterAll(async () => {
  await prisma.memberService.deleteMany({ where: { member: { businessId } } });
  await prisma.member.deleteMany({ where: { businessId } });
  await prisma.service.deleteMany({ where: { businessId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.business.delete({ where: { id: businessId } });
  await prisma.$disconnect();
});

describe('AvailabilityService.getBusiness (página pública)', () => {
  it('muestra solo servicios activos, con la URL pública de la foto', async () => {
    const page = await availability.getBusiness(slug);
    expect(page.services.map((s) => s.name)).toEqual(['Corte']);
    expect(page.services[0].imageUrl).toBe(
      `https://img.test/services/${run}.webp`,
    );
    expect(page.services[0]).not.toHaveProperty('imageKey');
  });

  it('muestra solo profesionales activos que atienden', async () => {
    const page = await availability.getBusiness(slug);
    expect(page.members.map((m) => m.displayName)).toEqual(['Dueña']);
  });

  it('no expone datos internos del negocio, del equipo ni de las cuentas', async () => {
    const page = await availability.getBusiness(slug);
    expect(Object.keys(page).sort()).toEqual(
      [
        'acceptsBookings',
        'members',
        'name',
        'phone',
        'services',
        'slug',
        'timezone',
      ].sort(),
    );
    expect(Object.keys(page.members[0]).sort()).toEqual(
      ['displayName', 'id', 'services'].sort(),
    );
    const text = JSON.stringify(page);
    expect(text).not.toContain(`public-${run}@test.local`);
    expect(text).not.toContain(userId);
    expect(text).not.toContain(businessId);
  });

  it('indica si el negocio recibe reservas según la verificación del dueño', async () => {
    expect((await availability.getBusiness(slug)).acceptsBookings).toBe(false);
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
    expect((await availability.getBusiness(slug)).acceptsBookings).toBe(true);
  });

  it('un slug que no existe responde 404', async () => {
    await expect(availability.getBusiness(`no-${run}`)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
