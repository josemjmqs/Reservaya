import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from './services.service';

// Servicio de Nest real contra PostgreSQL
const prisma = new PrismaClient();
const service = new ServicesService(prisma as unknown as PrismaService);
const run = Date.now().toString(36);

let businessId: string;
let userId: string;

beforeAll(async () => {
  businessId = (
    await prisma.business.create({
      data: { name: 'Servicios', slug: `int-services-${run}` },
    })
  ).id;
  userId = (
    await prisma.user.create({
      data: { email: `services-${run}@test.local`, name: 'Dueña', password: 'x' },
    })
  ).id;
  await prisma.member.create({
    data: { role: 'OWNER', displayName: 'Dueña', userId, businessId },
  });
});

afterAll(async () => {
  await prisma.service.deleteMany({ where: { businessId } }); // borra MemberService en cascada
  await prisma.member.deleteMany({ where: { businessId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.business.delete({ where: { id: businessId } });
  await prisma.$disconnect();
});

describe('descripción de servicios', () => {
  it('guarda la descripción sin espacios sobrantes y respeta los saltos de línea', async () => {
    const s = await service.create(userId, {
      name: 'Tinte',
      durationMin: 90,
      description: '  Incluye lavado.\nTraer foto de referencia.  ',
    });
    expect(s.description).toBe('Incluye lavado.\nTraer foto de referencia.');
  });

  it('una descripción vacía o solo con espacios se guarda como null', async () => {
    const s = await service.create(userId, {
      name: 'Corte',
      durationMin: 30,
      description: '   ',
    });
    expect(s.description).toBeNull();
  });

  it('al editar sin enviar la descripción no se pierde', async () => {
    const s = await service.create(userId, {
      name: 'Peinado',
      durationMin: 30,
      description: 'Con secado',
    });
    const updated = await service.update(userId, s.id, { price: 12000 });
    expect(updated.description).toBe('Con secado');
  });

  it('al editar con descripción vacía se borra', async () => {
    const s = await service.create(userId, {
      name: 'Barba',
      durationMin: 20,
      description: 'Con toalla caliente',
    });
    const updated = await service.update(userId, s.id, { description: '' });
    expect(updated.description).toBeNull();
  });
});
