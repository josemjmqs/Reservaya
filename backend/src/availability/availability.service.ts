import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MAX_SERVICES_PER_BOOKING } from './booking-limits';
import { findMemberSlots } from './member-slots';

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getSlots(
    slug: string,
    serviceIds: string[],
    date: string,
    memberId?: string,
  ) {
    const business = await this.prisma.business.findUnique({ where: { slug } });
    if (!business) throw new NotFoundException('Negocio no encontrado');

    const services = await this.resolveServices(business.id, serviceIds);
    const { durationMin, stepMin } = blockFor(services);

    const day = DateTime.fromISO(date, { zone: business.timezone });
    if (!day.isValid) return { slots: [] as string[] };

    const members = await this.membersForServices(
      business.id,
      services.map((s) => s.id),
      memberId,
    );

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
        durationMin,
        stepMin,
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
    stepMin?: number,
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
      stepMin,
    });
  }

  // Servicios pedidos en el orden del cliente y sin repetidos. Todos deben estar
  // activos y ser de este negocio (también la usa bookings)
  async resolveServices(businessId: string, serviceIds: string[]) {
    const ids = [...new Set(serviceIds)];
    if (!ids.length)
      throw new BadRequestException('Elige al menos un servicio');
    if (ids.length > MAX_SERVICES_PER_BOOKING) {
      throw new BadRequestException(
        `Puedes elegir hasta ${MAX_SERVICES_PER_BOOKING} servicios por reserva`,
      );
    }
    const found = await this.prisma.service.findMany({
      where: { id: { in: ids }, businessId, active: true },
    });
    if (found.length !== ids.length) {
      throw new NotFoundException('Servicio no encontrado');
    }
    const byId = new Map(found.map((s) => [s.id, s]));
    return ids.map((id) => byId.get(id)!);
  }

  // Profesionales que hacen TODOS los servicios (uno solo los hace seguidos)
  membersForServices(
    businessId: string,
    serviceIds: string[],
    memberId?: string,
  ) {
    return this.prisma.member.findMany({
      where: {
        businessId,
        active: true,
        bookable: true,
        ...(memberId && { id: memberId }),
        AND: serviceIds.map((serviceId) => ({
          services: { some: { serviceId } },
        })),
      },
      select: { id: true },
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
            imageKey: true,
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
    const services = business.services.map(({ imageKey, ...s }) => ({
      ...s,
      imageUrl: this.storage.urlFor(imageKey),
    }));
    return { ...business, services, acceptsBookings };
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

// Bloque de agenda para varios servicios seguidos: dura la suma, y las horas se
// ofrecen cada "servicio más corto" (con uno solo, igual que siempre: su duración)
export function blockFor(services: { durationMin: number }[]) {
  const durations = services.map((s) => s.durationMin);
  return {
    durationMin: durations.reduce((a, b) => a + b, 0),
    stepMin: Math.min(...durations),
  };
}
