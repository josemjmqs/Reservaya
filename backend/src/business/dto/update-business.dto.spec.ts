import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateBusinessDto } from './update-business.dto';

const parse = async (body: object) => {
  const dto = plainToInstance(UpdateBusinessDto, body);
  return { dto, errors: (await validate(dto)).map((e) => e.property) };
};

describe('UpdateBusinessDto', () => {
  it.each(['+56 9 1234 5678', '22 345 6789', '(2) 2345-6789', '912345678'])(
    'acepta el teléfono "%s"',
    async (phone) => {
      expect((await parse({ phone })).errors).toEqual([]);
    },
  );

  it.each(['hola', '1234', '+56 9 1234 5678 ext 2', '<b>912345678</b>'])(
    'rechaza el teléfono "%s"',
    async (phone) => {
      expect((await parse({ phone })).errors).toEqual(['phone']);
    },
  );

  it('un teléfono vacío se guarda como null (lo borra)', async () => {
    const { dto, errors } = await parse({ phone: '   ' });
    expect(errors).toEqual([]);
    expect(dto.phone).toBeNull();
  });

  it('quita espacios al nombre y exige al menos 2 letras', async () => {
    expect((await parse({ name: '  Taller Pérez ' })).dto.name).toBe(
      'Taller Pérez',
    );
    expect((await parse({ name: ' a ' })).errors).toEqual(['name']);
  });
});
