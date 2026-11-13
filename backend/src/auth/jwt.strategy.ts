import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AuthService } from './auth.service';
import type { SessionUser } from './session';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.['token'] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Además de la firma y el vencimiento, el token debe ser de la versión de
  // sesión actual del usuario (cambiar la contraseña cierra las demás)
  async validate(payload: {
    sub: string;
    email: string;
    sv?: number;
    iat: number;
  }): Promise<SessionUser> {
    const user = await this.auth.validateSession(payload);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
