import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';

const BOOKING_SELECT = {
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
} satisfies Prisma.BookingSelect;

type SelectedBooking = Prisma.BookingGetPayload<{
  select: typeof BOOKING_SELECT;
}>;

// La API responde los servicios planos (en orden) en vez de los items
const toAgendaBooking = ({ items, ...b }: SelectedBooking) => ({
  ...b,
  services: items.map((i) => i.service),
});

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

  // Si se filtra por profesional, debe ser de tu negocio (404 si no)
  private async assertMember(businessId: string, memberId?: string) {
    if (!memberId) return;
    const target = await this.prisma.member.findFirst({
      where: { id: memberId, businessId },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('Profesional no encontrado');
  }

  async list(userId: string, from: string, to: string, memberId?: string) {
    const business = await this.getBusiness(userId);
    await this.assertMember(business.id, memberId);

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
      select: BOOKING_SELECT,
    });
    return bookings.map(toAgendaBooking);
  }

  // Próxima reserva activa (pendiente o confirmada) que aún no empieza.
  // Se envuelve en { booking } porque Nest responde un null como cuerpo vacío
  async next(userId: string, memberId?: string, now = new Date()) {
    const business = await this.getBusiness(userId);
    await this.assertMember(business.id, memberId);

    const booking = await this.prisma.booking.findFirst({
      where: {
        businessId: business.id,
        ...(memberId && { memberId }),
        status: { in: ['PENDING', 'CONFIRMED'] },
        startsAt: { gt: now },
      },
      orderBy: { startsAt: 'asc' },
      select: BOOKING_SELECT,
    });
    return { booking: booking ? toAgendaBooking(booking) : null };
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
