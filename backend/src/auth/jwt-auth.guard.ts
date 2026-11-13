import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { renewSession } from './session';

// Además de exigir sesión, la renueva (como mucho una vez al día) para que
// venza recién tras 30 días sin uso. JwtService viene del JwtModule global,
// así los módulos que usan este guard no necesitan importar AuthModule
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly jwt: JwtService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = (await super.canActivate(context)) as boolean;
    if (ok) {
      const http = context.switchToHttp();
      await renewSession(
        http.getRequest<Request>(),
        http.getResponse<Response>(),
        this.jwt,
      );
    }
    return ok;
  }
}
