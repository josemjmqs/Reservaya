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

  async list(userId: string, from: string, to: string) {
    const business = await this.getBusiness(userId);
    const start = DateTime.fromISO(from, { zone: business.timezone }).startOf('day');
    const end = DateTime.fromISO(to, { zone: business.timezone }).endOf('day');

    return this.prisma.booking.findMany({
      where: {
        businessId: business.id,
        startsAt: { gte: start.toJSDate(), lte: end.toJSDate() },
      },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        notes: true,
        service: { select: { name: true, durationMin: true } },
        customer: { select: { name: true, email: true, phone: true } },
      },
    });
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