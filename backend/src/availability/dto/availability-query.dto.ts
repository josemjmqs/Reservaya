import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MAX_SERVICES_PER_BOOKING } from '../booking-limits';

export class AvailabilityQueryDto {
  // Servicios que se hacen seguidos, separados por coma: ?serviceIds=a,b
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : value,
  )
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

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date debe tener formato YYYY-MM-DD',
  })
  date: string;

  @IsOptional()
  @IsString()
  memberId?: string;
}
