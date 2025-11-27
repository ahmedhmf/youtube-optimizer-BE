import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address for password reset',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @Transform(({ value }: { value: any }): string =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Password reset token from email',
  })
  @IsString({ message: 'Token must be a string' })
  @IsNotEmpty({ message: 'Reset token is required' })
  @MinLength(10, { message: 'Invalid token format' })
  @MaxLength(1000, { message: 'Token too long' })
  token: string; // Supabase access token from password reset email

  @ApiProperty({
    example: 'NewSecurePassword123!',
    description: 'New strong password',
    minLength: 8,
    maxLength: 128,
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @IsNotEmpty({ message: 'New password is required' })
  newPassword: string;
}
