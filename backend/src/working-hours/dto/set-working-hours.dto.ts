import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class DayHoursDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @Matches(TIME, { message: 'opensAt debe tener formato HH:MM' })
  opensAt: string;

  @Matches(TIME, { message: 'closesAt debe tener formato HH:MM' })
  closesAt: string;
}

export class SetWorkingHoursDto {
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => DayHoursDto)
  days: DayHoursDto[];
}