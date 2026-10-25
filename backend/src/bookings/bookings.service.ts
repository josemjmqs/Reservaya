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

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  async create(slug: string, dto: CreateBookingDto) {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, businessId: business.id, active: true },
    });
    if (!service) throw new NotFoundException('Servicio no encontrado');

    const member = await this.prisma.member.findFirst({
      where: { businessId: business.id, bookable: true },
    });
    if (!member) throw new ConflictException('El negocio no tiene agenda');

    // La hora debe ser uno de los espacios que el sistema ofrece
    const startsAt = new Date(dto.startsAt);
    const date = DateTime.fromJSDate(startsAt, { zone: business.timezone })
      .toISODate()!;
    const { slots } = await this.availability.getSlots(
      slug,
      service.id,
      date,
    );
    if (!slots.includes(startsAt.toISOString())) {
      throw new ConflictException('Esa hora no está disponible');
    }

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
            memberId: member.id,
            serviceId: service.id,
            customerId: customer.id,
          },
        });
      });
      return {
        id: booking.id,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        status: booking.status,
        manageToken: booking.manageToken,
      };
    } catch (e) {
      // 23P01 = exclusion_violation de PostgreSQL (solape de reservas)
      if (this.isOverlap(e)) {
        throw new ConflictException('Esa hora ya fue tomada');
      }
      throw e;
    }
  }

  private isOverlap(e: unknown): boolean {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return JSON.stringify(e.meta ?? {}).includes('23P01') ||
        e.message.includes('booking_no_overlap');
    }
    if (e instanceof Prisma.PrismaClientUnknownRequestError) {
      return e.message.includes('booking_no_overlap') ||
        e.message.includes('23P01');
    }
    return false;
  }
}