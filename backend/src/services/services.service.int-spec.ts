import { PrismaClient } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageService } from '../storage/storage.service';
import { ServicesService } from './services.service';

// Servicio de Nest real contra PostgreSQL; R2 se reemplaza por un registro en memoria
const prisma = new PrismaClient();
const bucket = new Map<string, string>(); // ruta -> content type
const storage = {
  enabled: true,
  urlFor: (key: string | null) => (key ? `https://img.test/${key}` : null),
  put: (key: string, _body: Buffer, contentType: string) => {
    bucket.set(key, contentType);
    return Promise.resolve();
  },
  remove: (key: string) => {
    bucket.delete(key);
    return Promise.resolve();
  },
} as unknown as StorageService;
const service = new ServicesService(
  prisma as unknown as PrismaService,
  storage,
);

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const run = Date.now().toString(36);

let businessId: string;
let userId: string;
let otherUserId: string;
let otherBusinessId: string;

beforeAll(async () => {
  businessId = (
    await prisma.business.create({
      data: { name: 'Servicios', slug: `int-services-${run}` },
    })
  ).id;
  userId = (
    await prisma.user.create({
      data: {
        email: `services-${run}@test.local`,
        name: 'Dueña',
        password: 'x',
      },
    })
  ).id;
  await prisma.member.create({
    data: { role: 'OWNER', displayName: 'Dueña', userId, businessId },
  });
  otherBusinessId = (
    await prisma.business.create({
      data: { name: 'Otro', slug: `int-services-other-${run}` },
    })
  ).id;
  otherUserId = (
    await prisma.user.create({
      data: {
        email: `services-other-${run}@test.local`,
        name: 'Otro',
        password: 'x',
      },
    })
  ).id;
  await prisma.member.create({
    data: {
      role: 'OWNER',
      displayName: 'Otro',
      userId: otherUserId,
      businessId: otherBusinessId,
    },
  });
});

afterAll(async () => {
  const ids = [businessId, otherBusinessId];
  await prisma.service.deleteMany({ where: { businessId: { in: ids } } }); // borra MemberService en cascada
  await prisma.member.deleteMany({ where: { businessId: { in: ids } } });
  await prisma.user.deleteMany({
    where: { id: { in: [userId, otherUserId] } },
  });
  await prisma.business.deleteMany({ where: { id: { in: ids } } });
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

describe('duración total de servicios', () => {
  it('rechaza crear un servicio con duración total menor que la atención', async () => {
    await expect(
      service.create(userId, { name: 'Alisado', durationMin: 60, totalMin: 45 }),
    ).rejects.toThrow(
      new BadRequestException(
        'La duración total no puede ser menor que el tiempo de atención',
      ),
    );
  });

  it('acepta una duración total igual o mayor que la atención', async () => {
    const igual = await service.create(userId, {
      name: 'Manicure',
      durationMin: 40,
      totalMin: 40,
    });
    const mayor = await service.create(userId, {
      name: 'Permanente',
      durationMin: 60,
      totalMin: 180,
    });
    expect([igual.totalMin, mayor.totalMin]).toEqual([40, 180]);
  });

  it('al editar solo uno de los dos, lo compara con el valor guardado', async () => {
    const s = await service.create(userId, {
      name: 'Color',
      durationMin: 30,
      totalMin: 90,
    });
    // subir la atención por sobre el total guardado
    await expect(
      service.update(userId, s.id, { durationMin: 120 }),
    ).rejects.toThrow(BadRequestException);
    // bajar el total por debajo de la atención guardada
    await expect(
      service.update(userId, s.id, { totalMin: 20 }),
    ).rejects.toThrow(BadRequestException);
    // quitar el total siempre se puede
    const updated = await service.update(userId, s.id, { totalMin: null });
    expect(updated.totalMin).toBeNull();
  });

  it('activar un servicio no revisa las duraciones guardadas', async () => {
    // dato antiguo, anterior a esta regla: total menor que la atención
    const s = await prisma.service.create({
      data: {
        name: 'Antiguo',
        durationMin: 60,
        totalMin: 30,
        active: false,
        businessId,
      },
    });
    const updated = await service.update(userId, s.id, { active: true });
    expect(updated.active).toBe(true);
  });
});

describe('foto de servicios', () => {
  let serviceId: string;

  beforeAll(async () => {
    serviceId = (
      await service.create(userId, { name: 'Con foto', durationMin: 30 })
    ).id;
  });

  it('guarda la foto con el tipo detectado por su contenido y devuelve la URL pública', async () => {
    const s = await service.setImage(userId, serviceId, { buffer: JPG });
    expect(s.imageUrl).toMatch(
      new RegExp(
        `^https://img\\.test/services/${businessId}/${serviceId}/[0-9a-f]{16}\\.jpg$`,
      ),
    );
    expect(s).not.toHaveProperty('imageKey');
    expect([...bucket.values()]).toEqual(['image/jpeg']);
  });

  it('al reemplazarla borra la foto anterior del bucket', async () => {
    const before = [...bucket.keys()];
    const s = await service.setImage(userId, serviceId, { buffer: PNG });
    expect(s.imageUrl).toMatch(/\.png$/);
    expect(bucket.size).toBe(1);
    expect(bucket.has(before[0])).toBe(false);
  });

  it('rechaza archivos que no son JPG, PNG ni WebP', async () => {
    await expect(
      service.setImage(userId, serviceId, { buffer: Buffer.from('<svg/>') }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.setImage(userId, serviceId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('otro negocio no puede cambiar ni quitar la foto (404)', async () => {
    await expect(
      service.setImage(otherUserId, serviceId, { buffer: JPG }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.removeImage(otherUserId, serviceId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('el panel recibe la URL y quitar la foto la borra del bucket', async () => {
    const listed = (await service.findAll(userId)).find(
      (s) => s.id === serviceId,
    );
    expect(listed?.imageUrl).toMatch(/^https:\/\/img\.test\//);

    const s = await service.removeImage(userId, serviceId);
    expect(s.imageUrl).toBeNull();
    expect(bucket.size).toBe(0);
  });
});
