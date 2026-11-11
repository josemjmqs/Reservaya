import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { NotificationsService } from '../notifications/notifications.service';
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
  private readonly logger = new Logger(AgendaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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

  async updateStatus(
    userId: string,
    id: string,
    status: string,
    reason?: string,
  ) {
    const business = await this.getBusiness(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id, businessId: business.id },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    if (status === 'CANCELLED') {
      // Solo quien pasa la reserva de activa a cancelada avisa al cliente, así
      // no le llegan dos correos si se cancela dos veces al mismo tiempo
      const { count } = await this.prisma.booking.updateMany({
        where: { id, status: { in: ['PENDING', 'CONFIRMED'] } },
        data: { status: 'CANCELLED' },
      });
      if (count === 1) {
        void this.notifyCancelled(id, reason?.trim() || null);
        return { id, status: 'CANCELLED' as const };
      }
    }

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

  // Correo al cliente cuando el negocio cancela su reserva. Nunca lanza: un
  // fallo aquí no debe deshacer ni romper la cancelación
  private async notifyCancelled(id: string, reason: string | null) {
    try {
      const b = await this.prisma.booking.findUniqueOrThrow({
        where: { id },
        select: {
          startsAt: true,
          customer: { select: { name: true, email: true } },
          business: {
            select: { name: true, slug: true, phone: true, timezone: true },
          },
          items: {
            orderBy: { position: 'asc' },
            select: { service: { select: { name: true } } },
          },
        },
      });
      await this.notifications.bookingCancelledByBusiness({
        to: b.customer.email,
        customerName: b.customer.name,
        businessName: b.business.name,
        businessSlug: b.business.slug,
        businessPhone: b.business.phone,
        serviceName: b.items.map((i) => i.service.name).join(' + '),
        startsAt: b.startsAt,
        timezone: b.business.timezone,
        reason,
      });
    } catch (e) {
      this.logger.error('Error avisando la cancelación', e as Error);
    }
  }
}
