import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../types/roles.types';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }: { value: any }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : (value as string),
  )
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  email: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description:
      'Strong password with uppercase, lowercase, number and special character',
    minLength: 8,
    maxLength: 128,
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password: string;

  @ApiProperty({
    example: 'BETA-A1B2-C3D4',
    description: 'Invitation code required for registration (closed beta)',
  })
  @IsString({ message: 'Invitation code must be a string' })
  invitationCode: string;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'User full name',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MinLength(1, { message: 'Name cannot be empty' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  @Transform(({ value }: { value: any }) =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  @Matches(/^[a-zA-Z\s\-']+$/, {
    message: 'Name can only contain letters, spaces, hyphens, and apostrophes',
  })
  name?: string;

  @ApiPropertyOptional({
    example: UserRole.USER,
    description: 'User role',
    enum: UserRole,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be a valid user role' })
  role?: UserRole;
}
