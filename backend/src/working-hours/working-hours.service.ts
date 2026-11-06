import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SetWorkingHoursDto } from './dto/set-working-hours.dto';

@Injectable()
export class WorkingHoursService {
  constructor(private readonly prisma: PrismaService) {}

  // Resuelve el profesional objetivo. El negocio sale siempre de la
  // membresía del usuario autenticado, nunca del cliente.
  private async resolveMemberId(
    userId: string,
    memberId?: string,
  ): Promise<string> {
    const own = await this.prisma.member.findFirst({
      where: { userId },
      select: { id: true, businessId: true },
    });
    if (!own) throw new ForbiddenException('No perteneces a ningún negocio');
    if (!memberId) return own.id;

    const target = await this.prisma.member.findFirst({
      where: { id: memberId, businessId: own.businessId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('Profesional no encontrado');
    return target.id;
  }

  async findAll(userId: string, memberId?: string) {
    const id = await this.resolveMemberId(userId, memberId);
    return this.prisma.workingHours.findMany({
      where: { memberId: id },
      orderBy: { weekday: 'asc' },
    });
  }

  async replace(userId: string, dto: SetWorkingHoursDto) {
    const memberId = await this.resolveMemberId(userId, dto.memberId);

    const weekdays = dto.days.map((d) => d.weekday);
    if (new Set(weekdays).size !== weekdays.length) {
      throw new BadRequestException('Hay días repetidos');
    }
    for (const d of dto.days) {
      if (d.opensAt >= d.closesAt) {
        throw new BadRequestException(
          'La hora de apertura debe ser anterior al cierre',
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.workingHours.deleteMany({ where: { memberId } }),
      this.prisma.workingHours.createMany({
        data: dto.days.map((d) => ({ ...d, memberId })),
      }),
    ]);
    return this.findAll(userId, memberId);
  }
}