import { Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';
import { findMemberSlots } from './member-slots';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getSlots(
    slug: string,
    serviceId: string,
    date: string,
    memberId?: string,
  ) {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId: business.id, active: true },
    });
    if (!service) throw new NotFoundException('Servicio no encontrado');

    const day = DateTime.fromISO(date, { zone: business.timezone });
    if (!day.isValid) return { slots: [] as string[] };

    const members = await this.prisma.member.findMany({
      where: {
        businessId: business.id,
        active: true,
        bookable: true,
        ...(memberId && { id: memberId }),
        services: { some: { serviceId } },
      },
      select: { id: true },
    });

    const weekday = day.weekday % 7;
    const dayStart = day.startOf('day').toJSDate();
    const dayEnd = day.endOf('day').toJSDate();
    const all = new Set<string>();

    for (const m of members) {
      const slots = await this.slotsForMember(
        m.id,
        business.id,
        business.timezone,
        date,
        weekday,
        dayStart,
        dayEnd,
        service.durationMin,
      );
      slots.forEach((s) => all.add(s));
    }
    return { slots: [...all].sort() };
  }

  // Horas libres de un profesional concreto (también la usa bookings)
  async slotsForMember(
    memberId: string,
    businessId: string,
    timezone: string,
    date: string,
    weekday: number,
    dayStart: Date,
    dayEnd: Date,
    durationMin: number,
  ): Promise<string[]> {
    return findMemberSlots(this.prisma, {
      memberId,
      businessId,
      timezone,
      date,
      weekday,
      dayStart,
      dayEnd,
      durationMin,
    });
  }

  async getBusiness(slug: string) {
    const business = await this.prisma.business.findUnique({
      where: { slug },
      select: {
        name: true,
        slug: true,
        timezone: true,
        phone: true,
        services: {
          where: { active: true },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            durationMin: true,
            totalMin: true,
            price: true,
          },
        },
        members: {
          where: { active: true, bookable: true },
          orderBy: { id: 'asc' },
          select: {
            id: true,
            displayName: true,
            services: { select: { serviceId: true } },
          },
        },
      },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    const acceptsBookings = await this.acceptsBookings({ slug });
    return { ...business, acceptsBookings };
  }

  // Un negocio recibe reservas solo cuando su dueño verificó el correo:
  // evita que una cuenta falsa use la plataforma para enviar correos a terceros
  async acceptsBookings(business: { id: string } | { slug: string }) {
    const verifiedOwners = await this.prisma.member.count({
      where: {
        business,
        role: 'OWNER',
        user: { emailVerifiedAt: { not: null } },
      },
    });
    return verifiedOwners > 0;
  }
}
