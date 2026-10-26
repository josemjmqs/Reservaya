import { Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';
import { computeSlots } from './compute-slots';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getSlots(slug: string, serviceId: string, date: string) {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId: business.id, active: true },
    });
    if (!service) throw new NotFoundException('Servicio no encontrado');

    const member = await this.prisma.member.findFirst({
      where: { businessId: business.id, bookable: true },
    });
    if (!member) return { slots: [] };

    const day = DateTime.fromISO(date, { zone: business.timezone });
    if (!day.isValid) return { slots: [] };

    // luxon: lunes=1 ... domingo=7; nuestro modelo: domingo=0
    const weekday = day.weekday % 7;
    const hours = await this.prisma.workingHours.findFirst({
      where: { memberId: member.id, weekday },
    });
    if (!hours) return { slots: [] };

    const dayStart = day.startOf('day').toJSDate();
    const dayEnd = day.endOf('day').toJSDate();

    const [bookings, blocks] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          memberId: member.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
        },
      }),
      this.prisma.timeBlock.findMany({
        where: {
          businessId: business.id,
          OR: [{ memberId: null }, { memberId: member.id }],
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
        },
      }),
    ]);

    const slots = computeSlots({
      date,
      timezone: business.timezone,
      opensAt: hours.opensAt,
      closesAt: hours.closesAt,
      durationMin: service.durationMin,
      busy: [...bookings, ...blocks],
    });

    return { slots: slots.map((s) => s.toISOString()) };
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
            durationMin: true,
            price: true,
          },
        },
      },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    return business;
  }
}
