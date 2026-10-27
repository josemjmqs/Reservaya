import { IsIn } from 'class-validator';

export class UpdateStatusDto {
  @IsIn(['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
  status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
}