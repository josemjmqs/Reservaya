import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MAX_SERVICES_PER_BOOKING } from '../../availability/booking-limits';

export class CreateBookingDto {
  // Uno o más servicios, en el orden en que se hacen (los hace un mismo profesional)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(MAX_SERVICES_PER_BOOKING, {
    message: `Puedes elegir hasta ${MAX_SERVICES_PER_BOOKING} servicios por reserva`,
  })
  serviceIds?: string[];

  // Compatibilidad con el frontend anterior durante el despliegue; se puede quitar después
  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsString()
  memberId?: string; // si no viene, se asigna el primer profesional libre

  @IsISO8601()
  startsAt: string; // uno de los slots devueltos por /availability

  @IsString()
  @MinLength(2)
  name: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
