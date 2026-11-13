import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateServiceDto } from './create-service.dto';
import { UpdateServiceDto } from './update-service.dto';

const base = { name: 'Corte de pelo', durationMin: 30 };

const parse = async (body: object, Dto: new () => object = CreateServiceDto) => {
  const dto = plainToInstance(Dto, body) as CreateServiceDto;
  const errors = await validate(dto);
  return {
    dto,
    errors: errors.map((e) => e.property),
    messages: errors.flatMap((e) => Object.values(e.constraints ?? {})),
  };
};

describe('CreateServiceDto', () => {
  it('quita los espacios sobrantes del nombre', async () => {
    const { dto, errors } = await parse({ ...base, name: '  Corte  ' });
    expect(errors).toEqual([]);
    expect(dto.name).toBe('Corte');
  });

  it.each(['  ', ' a ', 'a'])(
    'rechaza el nombre "%s" (menos de 2 caracteres sin espacios), en español',
    async (name) => {
      const { errors, messages } = await parse({ ...base, name });
      expect(errors).toEqual(['name']);
      expect(messages).toEqual(['El nombre debe tener al menos 2 caracteres']);
    },
  );

  it('acepta hasta 80 caracteres en el nombre y rechaza más', async () => {
    expect((await parse({ ...base, name: 'a'.repeat(80) })).errors).toEqual([]);
    const { errors, messages } = await parse({ ...base, name: 'a'.repeat(81) });
    expect(errors).toEqual(['name']);
    expect(messages).toEqual(['El nombre puede tener hasta 80 caracteres']);
  });

  it('acepta hasta 40 caracteres en la categoría y rechaza más', async () => {
    expect(
      (await parse({ ...base, category: 'c'.repeat(40) })).errors,
    ).toEqual([]);
    const { errors, messages } = await parse({
      ...base,
      category: 'c'.repeat(41),
    });
    expect(errors).toEqual(['category']);
    expect(messages).toEqual(['La categoría puede tener hasta 40 caracteres']);
  });

  it('la duración total puede ser de hasta 30 días', async () => {
    expect((await parse({ ...base, totalMin: 43200 })).errors).toEqual([]);
    const { errors, messages } = await parse({ ...base, totalMin: 43201 });
    expect(errors).toEqual(['totalMin']);
    expect(messages).toEqual(['La duración total puede ser de hasta 30 días']);
  });

  it('al editar también quita espacios y exige el mínimo del nombre', async () => {
    const ok = await parse({ name: ' Barba ' }, UpdateServiceDto);
    expect(ok.errors).toEqual([]);
    expect(ok.dto.name).toBe('Barba');
    expect((await parse({ name: '   ' }, UpdateServiceDto)).errors).toEqual([
      'name',
    ]);
  });
});
