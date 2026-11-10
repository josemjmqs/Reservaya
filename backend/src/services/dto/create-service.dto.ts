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

export class CreateServiceDto {
  @IsString()
  @MinLength(2)
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

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(43200)
  totalMin?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string | null;
}
