import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Preferencias del usuario dentro de su negocio (su membresía)
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getMember(userId: string) {
    const member = await this.prisma.member.findFirst({
      where: { userId },
      select: {
        id: true,
        notifyNewBookings: true,
        user: { select: { email: true } },
      },
    });
    if (!member) throw new ForbiddenException('No perteneces a ningún negocio');
    return member;
  }

  async get(userId: string) {
    const member = await this.getMember(userId);
    return {
      newBookingEmail: member.notifyNewBookings,
      email: member.user!.email,
    };
  }

  async update(userId: string, newBookingEmail: boolean) {
    const member = await this.getMember(userId);
    await this.prisma.member.update({
      where: { id: member.id },
      data: { notifyNewBookings: newBookingEmail },
    });
    return { newBookingEmail, email: member.user!.email };
  }
}
