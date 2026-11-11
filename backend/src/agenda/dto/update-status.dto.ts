import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStatusDto {
  @IsIn(['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
  status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

  // Motivo opcional al cancelar: se incluye en el correo al cliente
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
