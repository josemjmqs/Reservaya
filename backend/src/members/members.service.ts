import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMemberDto, UpdateMemberDto } from './dto/member.dto';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  // El negocio sale de la membresía del usuario autenticado
  private async getBusinessId(userId: string): Promise<string> {
    const m = await this.prisma.member.findFirst({
      where: { userId },
      select: { businessId: true },
    });
    if (!m) throw new ForbiddenException('No perteneces a ningún negocio');
    return m.businessId;
  }

  // Todos los servicios deben ser del mismo negocio
  private async assertServices(businessId: string, ids: string[]) {
    if (!ids.length) return;
    const count = await this.prisma.service.count({
      where: { id: { in: ids }, businessId },
    });
    if (count !== ids.length) throw new BadRequestException('Servicio inválido');
  }

  async list(userId: string) {
    const businessId = await this.getBusinessId(userId);
    return this.prisma.member.findMany({
      where: { businessId },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        displayName: true,
        role: true,
        bookable: true,
        active: true,
        services: { select: { serviceId: true } },
      },
    });
  }

  async create(userId: string, dto: CreateMemberDto) {
    const businessId = await this.getBusinessId(userId);
    const serviceIds = dto.serviceIds ?? [];
    await this.assertServices(businessId, serviceIds);
    return this.prisma.member.create({
      data: {
        role: 'STAFF',
        displayName: dto.displayName,
        businessId,
        services: { create: serviceIds.map((serviceId) => ({ serviceId })) },
      },
      select: { id: true, displayName: true },
    });
  }

  async update(userId: string, id: string, dto: UpdateMemberDto) {
    const businessId = await this.getBusinessId(userId);
    const member = await this.prisma.member.findFirst({ where: { id, businessId } });
    if (!member) throw new NotFoundException('Profesional no encontrado');

    if (dto.serviceIds) await this.assertServices(businessId, dto.serviceIds);

    // El dueño no puede desactivarse a sí mismo
    if (dto.active === false && member.userId === userId) {
      throw new BadRequestException('No puedes desactivar tu propio perfil');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.serviceIds) {
        await tx.memberService.deleteMany({ where: { memberId: id } });
        await tx.memberService.createMany({
          data: dto.serviceIds.map((serviceId) => ({ memberId: id, serviceId })),
        });
      }
      return tx.member.update({
        where: { id },
        data: { displayName: dto.displayName, active: dto.active },
        select: { id: true, displayName: true, active: true },
      });
    });
  }
}