import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ManageBookingService {
  constructor(private readonly prisma: PrismaService) {}

  private async findByToken(token: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { manageToken: token },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        service: { select: { name: true, durationMin: true } },
        business: { select: { name: true, timezone: true, phone: true } },
      },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');
    return booking;
  }

  get(token: string) {
    return this.findByToken(token);
  }

  async cancel(token: string) {
    const booking = await this.findByToken(token);

    if (booking.status === 'CANCELLED') {
      throw new ConflictException('La reserva ya está cancelada');
    }
    if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
      throw new ConflictException('Esta reserva ya no se puede cancelar');
    }
    if (booking.startsAt.getTime() <= Date.now()) {
      throw new ConflictException('La reserva ya pasó');
    }

    return this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED' },
      select: { status: true },
    });
  }
}