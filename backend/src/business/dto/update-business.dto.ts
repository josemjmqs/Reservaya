import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateBusinessDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  // Teléfono que ven los clientes. Vacío o null lo borra
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const v = trim({ value });
    return v === '' ? null : v;
  })
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Matches(/^\+?[0-9 ()-]{8,20}$/, {
    message:
      'El teléfono solo puede tener números, espacios, +, - y paréntesis',
  })
  phone?: string | null;
}
