import type { JwtService } from '@nestjs/jwt';
import type { CookieOptions, Request, Response } from 'express';

// La sesión del panel dura 30 días sin uso: cada uso la renueva
export const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
// Se renueva como mucho una vez al día, no en cada petición
const RENEW_AFTER_MS = DAY_MS;

export const SESSION_COOKIE: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: SESSION_DAYS * DAY_MS,
  path: '/',
};

// Lo que JwtStrategy deja en req.user
export interface SessionUser {
  userId: string;
  email: string;
  sv: number;
  iat: number; // segundos (estándar JWT)
}

export const shouldRenew = (iat: number, now = Date.now()) =>
  now - iat * 1000 > RENEW_AFTER_MS;

// Si el token llegó por cookie y tiene más de un día, se firma uno nuevo y se
// vuelve a poner la cookie: así la sesión vence recién tras 30 días sin uso.
// Con el header Bearer (pruebas) no se toca nada
export async function renewSession(
  req: Request,
  res: Response,
  jwt: JwtService,
  now = Date.now(),
) {
  const user = req.user as SessionUser | undefined;
  const fromCookie = Boolean(req.cookies?.['token']);
  if (!user || !fromCookie || !shouldRenew(user.iat, now)) return;
  const token = await jwt.signAsync({
    sub: user.userId,
    email: user.email,
    sv: user.sv,
  });
  res.cookie('token', token, SESSION_COOKIE);
}
