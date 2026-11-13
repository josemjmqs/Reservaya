import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';

export const SERVICE_DESCRIPTION_MAX = 300;
// Iguales en el formulario del panel (dashboard/services)
export const SERVICE_NAME_MAX = 80;
export const SERVICE_CATEGORY_MAX = 40;
export const SERVICE_TOTAL_MAX = 43200; // 30 días, en minutos

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateServiceDto {
  // Se quitan los espacios antes de validar: "  " no es un nombre
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(SERVICE_NAME_MAX, {
    message: `El nombre puede tener hasta ${SERVICE_NAME_MAX} caracteres`,
  })
  name: string;

  // Información adicional que el cliente ve al elegir el servicio
  @IsOptional()
  @IsString()
  @MaxLength(SERVICE_DESCRIPTION_MAX, {
    message: `La descripción puede tener hasta ${SERVICE_DESCRIPTION_MAX} caracteres`,
  })
  description?: string | null;

  @IsInt()
  @Min(5)
  @Max(480)
  durationMin: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number | null;

  // No puede ser menor que durationMin: lo revisa ServicesService (necesita
  // el valor guardado cuando se edita solo uno de los dos)
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(SERVICE_TOTAL_MAX, {
    message: 'La duración total puede ser de hasta 30 días',
  })
  totalMin?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(SERVICE_CATEGORY_MAX, {
    message: `La categoría puede tener hasta ${SERVICE_CATEGORY_MAX} caracteres`,
  })
  category?: string | null;
}
