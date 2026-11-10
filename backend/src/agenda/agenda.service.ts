import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgendaService {
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

  async list(userId: string, from: string, to: string, memberId?: string) {
    const business = await this.getBusiness(userId);

    // Si se filtra por profesional, debe ser de tu negocio (404 si no)
    if (memberId) {
      const target = await this.prisma.member.findFirst({
        where: { id: memberId, businessId: business.id },
        select: { id: true },
      });
      if (!target) throw new NotFoundException('Profesional no encontrado');
    }

    const start = DateTime.fromISO(from, { zone: business.timezone }).startOf(
      'day',
    );
    const end = DateTime.fromISO(to, { zone: business.timezone }).endOf('day');

    const bookings = await this.prisma.booking.findMany({
      where: {
        businessId: business.id,
        ...(memberId && { memberId }),
        startsAt: { gte: start.toJSDate(), lte: end.toJSDate() },
      },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        notes: true,
        items: {
          orderBy: { position: 'asc' },
          select: { service: { select: { name: true, durationMin: true } } },
        },
        customer: { select: { name: true, email: true, phone: true } },
        member: { select: { id: true, displayName: true } },
      },
    });
    return bookings.map(({ items, ...b }) => ({
      ...b,
      services: items.map((i) => i.service),
    }));
  }

  async updateStatus(userId: string, id: string, status: string) {
    const business = await this.getBusiness(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id, businessId: business.id },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    try {
      return await this.prisma.booking.update({
        where: { id },
        data: { status: status as Prisma.BookingUpdateInput['status'] },
        select: { id: true, status: true },
      });
    } catch (e) {
      // Reactivar una reserva cancelada puede chocar con otra que tomó su hora
      if (e instanceof Error && e.message.includes('booking_no_overlap')) {
        throw new ConflictException('Esa hora ya fue tomada por otra reserva');
      }
      throw e;
    }
  }
}
