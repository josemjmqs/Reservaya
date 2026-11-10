import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import {
  AvailabilityService,
  blockFor,
} from '../availability/availability.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(slug: string, dto: CreateBookingDto) {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    if (!(await this.availability.acceptsBookings({ id: business.id }))) {
      throw new ForbiddenException(
        'Este negocio todavía no recibe reservas online',
      );
    }

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await this.prisma.booking.count({
      where: {
        businessId: business.id,
        customer: { email: dto.email },
        createdAt: { gte: since },
      },
    });
    if (recent >= 3) {
      throw new HttpException(
        'Demasiadas reservas con este correo, intenta más tarde',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const services = await this.availability.resolveServices(
      business.id,
      dto.serviceIds ?? (dto.serviceId ? [dto.serviceId] : []),
    );
    const { durationMin, stepMin } = blockFor(services);

    // Profesionales que hacen todos los servicios elegidos (o solo el elegido)
    const candidates = await this.availability.membersForServices(
      business.id,
      services.map((s) => s.id),
      dto.memberId,
    );
    if (!candidates.length) {
      throw new ConflictException(
        services.length > 1
          ? 'Ningún profesional disponible hace todos esos servicios'
          : 'Profesional no disponible',
      );
    }

    const startsAt = new Date(dto.startsAt);
    const day = DateTime.fromJSDate(startsAt, { zone: business.timezone });
    const date = day.toISODate()!;
    let memberId: string | null = null;

    for (const c of dto.memberId ? candidates : shuffle(candidates)) {
      const slots = await this.availability.slotsForMember(
        c.id,
        business.id,
        business.timezone,
        date,
        day.weekday % 7,
        day.startOf('day').toJSDate(),
        day.endOf('day').toJSDate(),
        durationMin,
        stepMin,
      );
      if (slots.includes(startsAt.toISOString())) {
        memberId = c.id;
        break;
      }
    }
    if (!memberId) throw new ConflictException('Esa hora no está disponible');

    const endsAt = new Date(startsAt.getTime() + durationMin * 60000);

    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        const customer = await tx.customer.upsert({
          where: {
            businessId_email: { businessId: business.id, email: dto.email },
          },
          update: { name: dto.name, phone: dto.phone },
          create: {
            businessId: business.id,
            name: dto.name,
            email: dto.email,
            phone: dto.phone,
          },
        });
        return tx.booking.create({
          data: {
            startsAt,
            endsAt,
            notes: dto.notes,
            businessId: business.id,
            memberId: memberId!,
            customerId: customer.id,
            items: {
              create: services.map((s, position) => ({
                serviceId: s.id,
                position,
              })),
            },
          },
        });
      });

      void this.notifications.bookingConfirmed({
        to: dto.email,
        customerName: dto.name,
        businessName: business.name,
        serviceName: services.map((s) => s.name).join(' + '),
        startsAt: booking.startsAt,
        timezone: business.timezone,
        manageToken: booking.manageToken,
      });
      void this.notifyStaff(booking.id);

      return {
        id: booking.id,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        status: booking.status,
        manageToken: booking.manageToken,
      };
    } catch (e) {
      if (this.isOverlap(e)) {
        throw new ConflictException('Esa hora ya fue tomada');
      }
      throw e;
    }
  }

  // Avisa por correo a los miembros con cuenta que tienen activados los avisos
  // de reservas nuevas. Nunca lanza: un fallo aquí no debe romper la reserva
  async notifyStaff(bookingId: string): Promise<void> {
    try {
      const booking = await this.prisma.booking.findUniqueOrThrow({
        where: { id: bookingId },
        select: {
          startsAt: true,
          notes: true,
          businessId: true,
          business: { select: { name: true, timezone: true } },
          member: { select: { displayName: true } },
          customer: { select: { name: true, email: true, phone: true } },
          items: {
            orderBy: { position: 'asc' },
            select: { service: { select: { name: true } } },
          },
        },
      });
      const recipients = await this.prisma.member.findMany({
        where: {
          businessId: booking.businessId,
          active: true,
          notifyNewBookings: true,
          userId: { not: null },
        },
        select: { user: { select: { email: true, name: true } } },
      });

      await Promise.all(
        recipients.map(({ user }) =>
          this.notifications.newBookingForStaff({
            to: user!.email,
            recipientName: user!.name,
            businessName: booking.business.name,
            customerName: booking.customer.name,
            customerEmail: booking.customer.email,
            customerPhone: booking.customer.phone,
            serviceName: booking.items.map((i) => i.service.name).join(' + '),
            memberName: booking.member.displayName,
            notes: booking.notes,
            startsAt: booking.startsAt,
            timezone: booking.business.timezone,
          }),
        ),
      );
    } catch (e) {
      this.logger.error('Error avisando la reserva nueva', e as Error);
    }
  }

  private isOverlap(e: unknown): boolean {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError ||
      e instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      const text = `${e.message} ${JSON.stringify(
        (e as { meta?: unknown }).meta ?? {},
      )}`;
      return (
        text.includes('booking_no_overlap') ||
        text.includes('23P01') ||
        text.includes('40P01') ||
        text.includes('deadlock')
      );
    }
    return false;
  }
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
