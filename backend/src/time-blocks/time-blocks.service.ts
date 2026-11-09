import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TimeBlock } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimeBlockDto } from './dto/create-time-block.dto';
import { isAllDay, resolveBlockRange } from './block-range';

const MAX_DAYS = 366;

@Injectable()
export class TimeBlocksService {
  constructor(private readonly prisma: PrismaService) {}

  // El negocio sale de la membresía del usuario, nunca del cliente
  private async getBusiness(userId: string) {
    const member = await this.prisma.member.findFirst({
      where: { userId },
      select: { business: { select: { id: true, timezone: true } } },
    });
    if (!member) throw new ForbiddenException('No perteneces a ningún negocio');
    return member.business;
  }

  private serialize(
    block: TimeBlock,
    timezone: string,
    names: Map<string, string>,
  ) {
    return {
      id: block.id,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
      reason: block.reason,
      allDay: isAllDay(block, timezone),
      member: block.memberId
        ? {
            id: block.memberId,
            displayName: names.get(block.memberId) ?? 'Profesional',
          }
        : null,
    };
  }

  private async memberNames(businessId: string, ids: (string | null)[]) {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    if (!unique.length) return new Map<string, string>();
    const members = await this.prisma.member.findMany({
      where: { id: { in: unique }, businessId },
      select: { id: true, displayName: true },
    });
    return new Map(members.map((m) => [m.id, m.displayName]));
  }

  // Bloqueos vigentes o futuros (los que ya terminaron no se muestran)
  async list(userId: string) {
    const business = await this.getBusiness(userId);
    const blocks = await this.prisma.timeBlock.findMany({
      where: { businessId: business.id, endsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
      take: 200,
    });
    const names = await this.memberNames(
      business.id,
      blocks.map((b) => b.memberId),
    );
    return {
      timezone: business.timezone,
      blocks: blocks.map((b) => this.serialize(b, business.timezone, names)),
    };
  }

  async create(userId: string, dto: CreateTimeBlockDto) {
    const business = await this.getBusiness(userId);

    // El profesional debe ser de tu negocio (404 si no)
    if (dto.memberId) {
      const member = await this.prisma.member.findFirst({
        where: { id: dto.memberId, businessId: business.id },
        select: { id: true },
      });
      if (!member) throw new NotFoundException('Profesional no encontrado');
    }

    const range = resolveBlockRange({ ...dto, timezone: business.timezone });
    if (!range) {
      throw new BadRequestException('El término debe ser posterior al inicio');
    }
    if (range.endsAt.getTime() <= Date.now()) {
      throw new BadRequestException('Ese período ya pasó');
    }
    const days = (range.endsAt.getTime() - range.startsAt.getTime()) / 86400000;
    if (days > MAX_DAYS) {
      throw new BadRequestException('Un bloqueo no puede durar más de un año');
    }

    const reason = dto.reason?.trim() || null;
    const block = await this.prisma.timeBlock.create({
      data: {
        ...range,
        reason,
        businessId: business.id,
        memberId: dto.memberId ?? null,
      },
    });

    // Las reservas existentes no se cancelan solas: se avisa cuántas hay
    const conflicts = await this.prisma.booking.count({
      where: {
        businessId: business.id,
        ...(dto.memberId && { memberId: dto.memberId }),
        status: { in: ['PENDING', 'CONFIRMED'] },
        startsAt: { lt: range.endsAt },
        endsAt: { gt: range.startsAt },
      },
    });

    const names = await this.memberNames(business.id, [block.memberId]);
    return {
      ...this.serialize(block, business.timezone, names),
      conflicts,
    };
  }

  async remove(userId: string, id: string) {
    const business = await this.getBusiness(userId);
    const block = await this.prisma.timeBlock.findFirst({
      where: { id, businessId: business.id },
      select: { id: true },
    });
    if (!block) throw new NotFoundException('Bloqueo no encontrado');
    await this.prisma.timeBlock.delete({ where: { id } });
    return { id };
  }
}
