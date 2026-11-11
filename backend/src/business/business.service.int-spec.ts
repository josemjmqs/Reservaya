import { ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { BusinessService } from './business.service';

const prisma = new PrismaClient();
const service = new BusinessService(prisma as unknown as PrismaService);
const run = Date.now().toString(36);

let businessId: string;
let otherBusinessId: string;
const userIds: Record<'owner' | 'staff' | 'other', string> = {
  owner: '',
  staff: '',
  other: '',
};

beforeAll(async () => {
  [businessId, otherBusinessId] = (
    await Promise.all(
      ['a', 'b'].map((x) =>
        prisma.business.create({
          data: { name: `Taller ${x}`, slug: `int-business-${x}-${run}` },
        }),
      ),
    )
  ).map((b) => b.id);
  for (const key of ['owner', 'staff', 'other'] as const) {
    userIds[key] = (
      await prisma.user.create({
        data: {
          email: `business-${key}-${run}@test.local`,
          name: key,
          password: 'x',
        },
      })
    ).id;
  }
  await prisma.member.createMany({
    data: [
      {
        role: 'OWNER',
        displayName: 'Dueño',
        userId: userIds.owner,
        businessId,
      },
      {
        role: 'STAFF',
        displayName: 'Ayudante',
        userId: userIds.staff,
        businessId,
      },
      {
        role: 'OWNER',
        displayName: 'Otro',
        userId: userIds.other,
        businessId: otherBusinessId,
      },
    ],
  });
});

afterAll(async () => {
  const ids = [businessId, otherBusinessId];
  await prisma.member.deleteMany({ where: { businessId: { in: ids } } });
  await prisma.user.deleteMany({
    where: { id: { in: Object.values(userIds) } },
  });
  await prisma.business.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe('BusinessService', () => {
  it('muestra los datos del propio negocio', async () => {
    expect(await service.get(userIds.owner)).toEqual({
      name: 'Taller a',
      slug: `int-business-a-${run}`,
      phone: null,
    });
  });

  it('el dueño cambia nombre y teléfono, sin tocar el otro negocio', async () => {
    expect(
      await service.update(userIds.owner, {
        name: 'Taller Pérez',
        phone: '+56 9 8765 4321',
      }),
    ).toMatchObject({ name: 'Taller Pérez', phone: '+56 9 8765 4321' });
    expect((await service.get(userIds.other)).name).toBe('Taller b');
  });

  it('cambiar solo el teléfono deja el nombre como estaba, y null lo borra', async () => {
    await service.update(userIds.owner, { phone: '22 345 6789' });
    expect((await service.get(userIds.owner)).name).toBe('Taller Pérez');
    await service.update(userIds.owner, { phone: null });
    expect((await service.get(userIds.owner)).phone).toBeNull();
  });

  it('un miembro que no es dueño no puede cambiarlos', async () => {
    await expect(
      service.update(userIds.staff, { name: 'Mío' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect((await service.get(userIds.staff)).name).toBe('Taller Pérez');
  });
});
