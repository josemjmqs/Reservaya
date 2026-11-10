import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const VERIFY_MAX_PER_HOUR = 3;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationsService,
  ) {}

  async register(dto: RegisterDto) {
    const [emailTaken, slugTaken] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email } }),
      this.prisma.business.findUnique({ where: { slug: dto.slug } }),
    ]);
    if (emailTaken)
      throw new ConflictException('Ese correo ya está registrado');
    if (slugTaken) throw new ConflictException('Ese slug ya está en uso');

    const password = await bcrypt.hash(dto.password, 10);
    const verifyToken = randomBytes(32).toString('hex');

    const user = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: dto.email, name: dto.name, password },
      });
      await tx.emailVerificationToken.create({
        data: {
          tokenHash: this.hash(verifyToken),
          expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
          userId: user.id,
        },
      });
      const business = await tx.business.create({
        data: { name: dto.businessName, slug: dto.slug },
      });
      await tx.member.create({
        data: {
          role: 'OWNER',
          displayName: dto.name,
          userId: user.id,
          businessId: business.id,
        },
      });
      return user;
    });

    // sin await: el registro no espera al correo
    void this.notifications.emailVerification(user.email, user.name, verifyToken);
    return this.signToken(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const valid = user && (await bcrypt.compare(dto.password, user.password));
    if (!user || !valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return this.signToken(user.id, user.email);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        members: {
          select: {
            role: true,
            business: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  // Solo se guarda el hash del token, nunca el token
  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = randomBytes(32).toString('hex');
      await this.prisma.passwordResetToken.create({
        data: {
          tokenHash: this.hash(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
          userId: user.id,
        },
      });
      // sin await: el cliente no espera al correo
      void this.notifications.passwordReset(user.email, user.name, token);
    }
    // Misma respuesta exista o no el correo: no revela qué cuentas existen
    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hash(token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('El enlace no es válido o expiró');
    }

    const hashed = await bcrypt.hash(password, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { password: hashed },
      }),
      // invalida este y cualquier otro enlace pendiente del usuario
      this.prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { user: { select: { emailVerifiedAt: true } } },
    });
    if (!record) {
      throw new BadRequestException('El enlace no es válido o expiró');
    }
    // Abrir el enlace dos veces no es un error si la cuenta ya quedó verificada
    if (record.user.emailVerifiedAt) return { ok: true };
    if (record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('El enlace no es válido o expiró');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: now },
      }),
      this.prisma.emailVerificationToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: now },
      }),
    ]);
    return { ok: true };
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.emailVerifiedAt) return { ok: true, alreadyVerified: true };

    const recent = await this.prisma.emailVerificationToken.count({
      where: { userId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recent >= VERIFY_MAX_PER_HOUR) {
      throw new HttpException(
        'Ya enviamos varios correos, revisa tu bandeja o intenta en una hora',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const token = randomBytes(32).toString('hex');
    await this.prisma.emailVerificationToken.create({
      data: {
        tokenHash: this.hash(token),
        expiresAt: new Date(Date.now() + VERIFY_TTL_MS),
        userId,
      },
    });
    void this.notifications.emailVerification(user.email, user.name, token);
    return { ok: true, alreadyVerified: false };
  }

  private async signToken(userId: string, email: string) {
    const accessToken = await this.jwt.signAsync({ sub: userId, email });
    return { accessToken };
  }
}
