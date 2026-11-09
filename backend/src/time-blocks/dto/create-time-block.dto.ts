import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateTimeBlockDto {
  @Matches(DATE, { message: 'startDate debe tener formato YYYY-MM-DD' })
  startDate: string;

  @Matches(DATE, { message: 'endDate debe tener formato YYYY-MM-DD' })
  endDate: string;

  @IsBoolean()
  allDay: boolean;

  @ValidateIf((o: CreateTimeBlockDto) => !o.allDay)
  @Matches(TIME, { message: 'startTime debe tener formato HH:mm' })
  startTime?: string;

  @ValidateIf((o: CreateTimeBlockDto) => !o.allDay)
  @Matches(TIME, { message: 'endTime debe tener formato HH:mm' })
  endTime?: string;

  // Sin profesional, el bloqueo aplica a todo el negocio
  @IsOptional()
  @IsString()
  memberId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reason?: string;
}
