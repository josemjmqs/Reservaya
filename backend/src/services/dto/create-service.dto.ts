import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(5)
  @Max(480)
  durationMin: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(43200) // hasta 30 días
  totalMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;
}
