import {
  IsEmail,
  IsNotIn,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

const RESERVED_SLUGS = [
  'login',
  'register',
  'dashboard',
  'reserva',
  'api',
  'admin',
];

export class RegisterDto {
  @IsString()
  @MinLength(2)
  name: string;

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