import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

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
    const businessId = await this.getBusinessId(userId);
    return this.prisma.service.create({ data: { ...dto, businessId } });
  }

  async findAll(userId: string) {
    const businessId = await this.getBusinessId(userId);
    return this.prisma.service.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(userId: string, id: string, dto: UpdateServiceDto) {
    const businessId = await this.getBusinessId(userId);
    await this.findOwned(id, businessId);
    return this.prisma.service.update({ where: { id }, data: dto });
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