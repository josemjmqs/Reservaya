import { IsString, Matches } from 'class-validator';

export class AvailabilityQueryDto {
  @IsString()
  serviceId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date debe tener formato YYYY-MM-DD' })
  date: string;
}