import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBusinessDto } from './dto/update-business.dto';

const SELECT = { name: true, slug: true, phone: true } as const;

// Datos del negocio que ven los clientes (página pública y correos)
@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  private async membership(userId: string) {
    const member = await this.prisma.member.findFirst({
      where: { userId },
      select: { role: true, businessId: true },
    });
    if (!member) throw new ForbiddenException('No perteneces a ningún negocio');
    return member;
  }

  async get(userId: string) {
    const { businessId } = await this.membership(userId);
    return this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: SELECT,
    });
  }

  // Solo el dueño cambia los datos del negocio
  async update(userId: string, dto: UpdateBusinessDto) {
    const { role, businessId } = await this.membership(userId);
    if (role !== 'OWNER') {
      throw new ForbiddenException('Solo el dueño puede cambiar estos datos');
    }
    return this.prisma.business.update({
      where: { id: businessId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
      },
      select: SELECT,
    });
  }
}
