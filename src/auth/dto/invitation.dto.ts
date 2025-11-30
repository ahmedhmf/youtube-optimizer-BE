import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';

export class RegisterWithInvitationDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;

  @IsString()
  invitationCode: string;
}

export class ValidateInvitationDto {
  @IsString()
  code: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}

export class CreateInvitationDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsOptional()
  maxUses?: number = 1;

  @IsOptional()
  expiresInDays?: number;

  @IsOptional()
  metadata?: Record<string, any>;
}
