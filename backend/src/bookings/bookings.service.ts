import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { AvailabilityService } from '../availability/availability.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(slug: string, dto: CreateBookingDto) {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, businessId: business.id, active: true },
    });
    if (!service) throw new NotFoundException('Servicio no encontrado');

    // Profesionales que pueden hacer este servicio (o solo el elegido)
    const candidates = await this.prisma.member.findMany({
      where: {
        businessId: business.id,
        active: true,
        bookable: true,
        ...(dto.memberId && { id: dto.memberId }),
        services: { some: { serviceId: service.id } },
      },
      select: { id: true },
    });
    if (!candidates.length) {
      throw new ConflictException('Profesional no disponible');
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
        service.durationMin,
      );
      if (slots.includes(startsAt.toISOString())) {
        memberId = c.id;
        break;
      }
    }
    if (!memberId) throw new ConflictException('Esa hora no está disponible');

    const endsAt = new Date(startsAt.getTime() + service.durationMin * 60000);

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
            serviceId: service.id,
            customerId: customer.id,
          },
        });
      });

      void this.notifications.bookingConfirmed({
        to: dto.email,
        customerName: dto.name,
        businessName: business.name,
        serviceName: service.name,
        startsAt: booking.startsAt,
        timezone: business.timezone,
        manageToken: booking.manageToken,
      });

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

  private isOverlap(e: unknown): boolean {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return (
        JSON.stringify(e.meta ?? {}).includes('23P01') ||
        e.message.includes('booking_no_overlap')
      );
    }
    if (e instanceof Prisma.PrismaClientUnknownRequestError) {
      return (
        e.message.includes('booking_no_overlap') || e.message.includes('23P01')
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