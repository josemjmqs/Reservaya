import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SetWorkingHoursDto } from './dto/set-working-hours.dto';

@Injectable()
export class WorkingHoursService {
  constructor(private readonly prisma: PrismaService) {}

  private async getMemberId(userId: string): Promise<string> {
    const member = await this.prisma.member.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('No perteneces a ningún negocio');
    return member.id;
  }

  async findAll(userId: string) {
    const memberId = await this.getMemberId(userId);
    return this.prisma.workingHours.findMany({
      where: { memberId },
      orderBy: { weekday: 'asc' },
    });
  }

  async replace(userId: string, dto: SetWorkingHoursDto) {
    const memberId = await this.getMemberId(userId);

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
    return this.findAll(userId);
  }
}