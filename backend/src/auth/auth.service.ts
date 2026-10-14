import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const [emailTaken, slugTaken] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email } }),
      this.prisma.business.findUnique({ where: { slug: dto.slug } }),
    ]);
    if (emailTaken) throw new ConflictException('Ese correo ya está registrado');
    if (slugTaken) throw new ConflictException('Ese slug ya está en uso');

    const password = await bcrypt.hash(dto.password, 10);

    // Todo o nada: si algo falla, no queda nada a medias
    const user = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: dto.email, name: dto.name, password },
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

  private async signToken(userId: string, email: string) {
    const accessToken = await this.jwt.signAsync({ sub: userId, email });
    return { accessToken };
  }
}