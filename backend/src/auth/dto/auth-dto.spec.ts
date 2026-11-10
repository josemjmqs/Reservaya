import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { readdirSync } from 'fs';
import { join } from 'path';
import { LoginDto } from './login.dto';
import { ForgotPasswordDto } from './password-reset.dto';
import { RegisterDto } from './register.dto';

// Validación de entrada tal como la aplica el ValidationPipe global
const valid = {
  name: 'Dueña',
  email: 'duena@test.local',
  password: 'password123',
  businessName: 'Mi negocio',
  slug: 'mi-negocio',
};
const errorsFor = async (dto: object) =>
  (await validate(dto)).map((e) => e.property);
const registerErrors = (over: Partial<typeof valid>) =>
  errorsFor(plainToInstance(RegisterDto, { ...valid, ...over }));

describe('RegisterDto', () => {
  it('acepta datos válidos', async () => {
    expect(await registerErrors({})).toEqual([]);
  });

  it.each(['Mi Negocio', 'mi_negocio', '-negocio', 'negocio-', 'mi--negocio'])(
    'rechaza el slug "%s"',
    async (slug) => {
      expect(await registerErrors({ slug })).toEqual(['slug']);
    },
  );

  it('rechaza contraseñas de menos de 8 caracteres', async () => {
    expect(await registerErrors({ password: '1234567' })).toEqual(['password']);
  });

  // Regla del proyecto: cada ruta nueva del frontend debe estar en RESERVED_SLUGS,
  // o un negocio podría registrarse con ese nombre y su página quedaría tapada
  const routes = readdirSync(join(process.cwd(), '../frontend/src/app'), {
    withFileTypes: true,
  })
    .filter((d) => d.isDirectory() && !d.name.startsWith('['))
    .map((d) => d.name);

  it.each([...routes, 'api', 'admin'])(
    'la ruta "%s" no se puede usar como slug',
    async (slug) => {
      expect(await registerErrors({ slug })).toEqual(['slug']);
    },
  );
});

describe('normalización del correo', () => {
  it.each([
    ['RegisterDto', RegisterDto, valid],
    ['LoginDto', LoginDto, { password: 'x' }],
    ['ForgotPasswordDto', ForgotPasswordDto, {}],
  ] as const)(
    '%s guarda el correo sin espacios y en minúsculas',
    async (_, Dto, rest) => {
      const dto = plainToInstance(Dto, {
        ...rest,
        email: '  Duena@Test.LOCAL ',
      });
      expect(dto.email).toBe('duena@test.local');
      expect(await errorsFor(dto)).toEqual([]);
    },
  );
});
