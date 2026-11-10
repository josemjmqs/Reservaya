import {
  IsEmail,
  IsNotIn,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const RESERVED_SLUGS = [
  'login',
  'register',
  'dashboard',
  'reserva',
  'api',
  'admin',
  'forgot-password',
  'reset-password',
  'verify-email',
  'privacidad',
  'terminos',
];

export class RegisterDto {
  @IsString()
  @MinLength(2)
  name: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(2)
  businessName: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug solo puede tener minúsculas, números y guiones',
  })
  @IsNotIn(RESERVED_SLUGS, { message: 'Ese slug no está disponible' })
  slug: string;
}
