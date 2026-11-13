import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Service } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { detectImageType } from '../storage/image-type';
import { StorageService } from '../storage/storage.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // El cliente recibe la URL pública de la foto, no la ruta interna del bucket
  private withImageUrl({ imageKey, ...service }: Service) {
    return { ...service, imageUrl: this.storage.urlFor(imageKey) };
  }

  // El negocio sale de la membresía del usuario autenticado, nunca del body
  private async getBusinessId(userId: string): Promise<string> {
    const member = await this.prisma.member.findFirst({
      where: { userId },
      select: { businessId: true },
    });
    if (!member) throw new ForbiddenException('No perteneces a ningún negocio');
    return member.businessId;
  }

  async create(userId: string, dto: CreateServiceDto) {
    assertTotalCoversDuration(dto.durationMin, dto.totalMin);
    const businessId = await this.getBusinessId(userId);
    const owners = await this.prisma.member.findMany({
      where: { businessId, role: 'OWNER' },
      select: { id: true },
    });
    return this.prisma.service.create({
      data: {
        ...dto,
        category: normalizeText(dto.category) ?? null,
        description: normalizeText(dto.description) ?? null,
        businessId,
        members: { create: owners.map((o) => ({ memberId: o.id })) },
      },
    });
  }

  async findAll(userId: string) {
    const businessId = await this.getBusinessId(userId);
    const services = await this.prisma.service.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });
    return services.map((s) => this.withImageUrl(s));
  }

  async setImage(userId: string, id: string, file?: { buffer: Buffer }) {
    if (!this.storage.enabled) {
      throw new ServiceUnavailableException(
        'La subida de fotos todavía no está disponible',
      );
    }
    const businessId = await this.getBusinessId(userId);
    const service = await this.findOwned(id, businessId);
    if (!file) throw new BadRequestException('Falta la foto');
    const type = detectImageType(file.buffer);
    if (!type) {
      throw new BadRequestException('La foto debe ser JPG, PNG o WebP');
    }

    // Ruta nueva en cada subida: así la caché nunca muestra la foto anterior
    const key = `services/${businessId}/${id}/${randomBytes(8).toString('hex')}.${type.ext}`;
    await this.storage.put(key, file.buffer, type.mime);
    const updated = await this.prisma.service.update({
      where: { id },
      data: { imageKey: key },
    });
    if (service.imageKey) void this.storage.remove(service.imageKey);
    return this.withImageUrl(updated);
  }

  async removeImage(userId: string, id: string) {
    const businessId = await this.getBusinessId(userId);
    const service = await this.findOwned(id, businessId);
    const updated = await this.prisma.service.update({
      where: { id },
      data: { imageKey: null },
    });
    if (service.imageKey) void this.storage.remove(service.imageKey);
    return this.withImageUrl(updated);
  }

  async update(userId: string, id: string, dto: UpdateServiceDto) {
    const businessId = await this.getBusinessId(userId);
    const current = await this.findOwned(id, businessId);
    // Solo si se cambia alguno de los dos (activar un servicio no lo revisa);
    // el que no viene se toma de lo guardado
    if (dto.durationMin !== undefined || dto.totalMin !== undefined) {
      assertTotalCoversDuration(
        dto.durationMin ?? current.durationMin,
        dto.totalMin === undefined ? current.totalMin : dto.totalMin,
      );
    }
    return this.prisma.service.update({
      where: { id },
      data: {
        ...dto,
        category: normalizeText(dto.category),
        description: normalizeText(dto.description),
      },
    });
  }

  // Borrado lógico: se desactiva para no perder el historial de reservas
  async deactivate(userId: string, id: string) {
    const businessId = await this.getBusinessId(userId);
    await this.findOwned(id, businessId);
    return this.prisma.service.update({
      where: { id },
      data: { active: false },
    });
  }

  // Si el servicio existe pero es de otro negocio, responde 404 (no revela que existe)
  private async findOwned(id: string, businessId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, businessId },
    });
    if (!service) throw new NotFoundException('Servicio no encontrado');
    return service;
  }
}

// La duración total (informativa) incluye el tiempo de atención: no puede ser menor
function assertTotalCoversDuration(
  durationMin: number,
  totalMin: number | null | undefined,
) {
  if (totalMin != null && totalMin < durationMin) {
    throw new BadRequestException(
      'La duración total no puede ser menor que el tiempo de atención',
    );
  }
}

// undefined = no se modifica; vacío o solo espacios = se borra (null)
function normalizeText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  return value?.trim() || null;
}
