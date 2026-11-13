import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import type { NotificationsService } from '../notifications/notifications.service';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

// Registro, inicio de sesión y restablecer contraseña contra PostgreSQL;
// el correo se reemplaza por un registro en memoria
const prisma = new PrismaClient();
const jwt = new JwtService({ secret: 'test-secret' });
const resets: { to: string; token: string }[] = [];
const notifications = {
  emailVerification: () => Promise.resolve(),
  passwordReset: (to: string, _name: string, token: string) => {
    resets.push({ to, token });
    return Promise.resolve();
  },
} as unknown as NotificationsService;
const auth = new AuthService(
  prisma as unknown as PrismaService,
  jwt,
  notifications,
);

const run = Date.now().toString(36);
const email = `auth-${run}@test.local`;
const slug = `int-auth-${run}`;
const extraSlugs: string[] = [];
let userId: string;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const register = (over: Partial<Parameters<AuthService['register']>[0]>) =>
  auth.register({
    name: 'Dueña',
    email,
    password: 'password123',
    businessName: 'Negocio Auth',
    slug,
    ...over,
  });
// Pide un enlace y devuelve el token que viajó en el correo
const requestReset = async () => {
  await auth.forgotPassword(email);
  return resets.filter((r) => r.to === email).at(-1)!.token;
};

beforeAll(async () => {
  await register({});
  userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
});

afterAll(async () => {
  const businesses = await prisma.business.findMany({
    where: { slug: { in: [slug, ...extraSlugs] } },
  });
  const ids = businesses.map((b) => b.id);
  const members = await prisma.member.findMany({
    where: { businessId: { in: ids } },
    select: { userId: true },
  });
  await prisma.member.deleteMany({ where: { businessId: { in: ids } } });
  await prisma.business.deleteMany({ where: { id: { in: ids } } });
  // los tokens se borran en cascada con el usuario
  await prisma.user.deleteMany({
    where: {
      id: {
        in: members.map((m) => m.userId).filter((id): id is string => !!id),
      },
    },
  });
  await prisma.$disconnect();
});

describe('registro', () => {
  it('crea el usuario sin verificar, su negocio y lo deja como dueño', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { members: { include: { business: true } } },
    });
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.password).not.toBe('password123');
    expect(user.members).toHaveLength(1);
    expect(user.members[0].role).toBe('OWNER');
    expect(user.members[0].business.slug).toBe(slug);
  });

  it('rechaza un correo ya registrado', async () => {
    await expect(register({ slug: `${slug}-otro` })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rechaza un slug ya usado por otro negocio', async () => {
    await expect(
      register({ email: `auth-otro-${run}@test.local` }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('dos registros simultáneos con el mismo slug: uno entra y el otro recibe 409, no un error 500', async () => {
    const raceSlug = `${slug}-carrera`;
    extraSlugs.push(raceSlug);
    const results = await Promise.allSettled(
      ['a', 'b'].map((x) =>
        register({ email: `auth-race-${x}-${run}@test.local`, slug: raceSlug }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected');
    expect(failed?.reason).toBeInstanceOf(ConflictException);
  });
});

describe('inicio de sesión', () => {
  it('con la contraseña correcta entrega un token con el id del usuario', async () => {
    const { accessToken } = await auth.login({
      email,
      password: 'password123',
    });
    const payload = await jwt.verifyAsync<{ sub: string; email: string }>(
      accessToken,
    );
    expect(payload).toMatchObject({ sub: userId, email });
  });

  it('contraseña incorrecta y correo inexistente dan el mismo error', async () => {
    const errors = await Promise.all(
      [
        auth.login({ email, password: 'otra-clave' }),
        auth.login({
          email: `nadie-${run}@test.local`,
          password: 'password123',
        }),
      ].map((p) =>
        p.then(
          () => null,
          (e: Error) => e,
        ),
      ),
    );
    expect(errors[0]).toBeInstanceOf(UnauthorizedException);
    expect(errors[1]).toBeInstanceOf(UnauthorizedException);
    expect(errors[0]!.message).toBe(errors[1]!.message);
  });
});

describe('restablecer contraseña', () => {
  it('un correo que no existe responde igual y no crea enlaces ni envía correos', async () => {
    const before = resets.length;
    expect(await auth.forgotPassword(`nadie-${run}@test.local`)).toEqual({
      ok: true,
    });
    expect(resets.length).toBe(before);
  });

  it('guarda solo el hash del token y el enlace vence en una hora', async () => {
    const token = await requestReset();
    const record = await prisma.passwordResetToken.findUniqueOrThrow({
      where: { tokenHash: sha256(token) },
    });
    expect(record.tokenHash).not.toBe(token);
    expect(record.userId).toBe(userId);
    const minutes = (record.expiresAt.getTime() - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(58);
    expect(minutes).toBeLessThanOrEqual(60);
  });

  it('un token válido cambia la contraseña', async () => {
    const token = await requestReset();
    await auth.resetPassword(token, 'nueva-clave-1');
    await expect(
      auth.login({ email, password: 'nueva-clave-1' }),
    ).resolves.toHaveProperty('accessToken');
    await expect(
      auth.login({ email, password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('el enlace sirve una sola vez', async () => {
    const token = await requestReset();
    await auth.resetPassword(token, 'nueva-clave-2');
    await expect(
      auth.resetPassword(token, 'nueva-clave-3'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('usar un enlace invalida los demás enlaces pendientes', async () => {
    const first = await requestReset();
    const second = await requestReset();
    await auth.resetPassword(second, 'nueva-clave-4');
    await expect(
      auth.resetPassword(first, 'nueva-clave-5'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un enlace vencido', async () => {
    const token = await requestReset();
    await prisma.passwordResetToken.update({
      where: { tokenHash: sha256(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      auth.resetPassword(token, 'nueva-clave-6'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un token inventado', async () => {
    await expect(
      auth.resetPassword('a'.repeat(64), 'nueva-clave-7'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('sesiones', () => {
  type Payload = { sub: string; email: string; sv?: number; iat: number };
  const loginWith = async (password: string) => {
    const { accessToken } = await auth.login({ email, password });
    return jwt.verify<Payload>(accessToken);
  };
  const versionOf = async (id: string) =>
    (await prisma.user.findUniqueOrThrow({ where: { id } })).sessionVersion;

  it('el token del login trae la versión de sesión del usuario', async () => {
    await auth.resetPassword(await requestReset(), 'clave-sesiones-1');
    const payload = await loginWith('clave-sesiones-1');
    expect(payload.sv).toBe(await versionOf(userId));
    expect(await auth.validateSession(payload)).toMatchObject({
      userId,
      email,
      sv: payload.sv,
    });
  });

  it('cambiar la contraseña con el enlace deja fuera las sesiones abiertas', async () => {
    const before = await loginWith('clave-sesiones-1');
    const version = await versionOf(userId);

    await auth.resetPassword(await requestReset(), 'clave-sesiones-2');

    expect(await versionOf(userId)).toBe(version + 1);
    expect(await auth.validateSession(before)).toBeNull();
    // la sesión nueva, con la contraseña nueva, sí vale
    const after = await loginWith('clave-sesiones-2');
    expect(await auth.validateSession(after)).not.toBeNull();
  });

  it('un token sin versión (anterior a este cambio) vale mientras la versión sea 0', async () => {
    const user = await prisma.user.create({
      data: { email: `old-token-${run}@test.local`, name: 'Antiguo', password: 'x' },
    });
    try {
      const old = { sub: user.id, email: user.email, iat: 0 };
      expect(await auth.validateSession(old)).toMatchObject({ sv: 0 });
      await prisma.user.update({
        where: { id: user.id },
        data: { sessionVersion: 1 },
      });
      expect(await auth.validateSession(old)).toBeNull();
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('el token de un usuario que ya no existe no vale', async () => {
    expect(
      await auth.validateSession({ sub: 'no-existe', email, sv: 0, iat: 0 }),
    ).toBeNull();
  });
});
