import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { UserRole } from '../../auth/types/roles.types';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'User email address' })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiPropertyOptional({ description: 'User full name' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    description: 'User role',
    enum: UserRole,
    example: UserRole.USER,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Invalid user role' })
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Profile picture URL' })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i, {
    message: 'Please provide a valid image URL',
  })
  picture?: string;

  @ApiPropertyOptional({
    description: 'Account status',
    enum: ['active', 'locked', 'inactive'],
  })
  @IsOptional()
  @IsEnum(['active', 'locked', 'inactive'], {
    message: 'Invalid account status',
  })
  accountStatus?: 'active' | 'locked' | 'inactive';
}

export class UpdateUserSubscriptionDto {
  @ApiProperty({
    description: 'Subscription tier',
    enum: ['free', 'basic', 'pro', 'enterprise'],
    example: 'pro',
  })
  @IsEnum(['free', 'basic', 'pro', 'enterprise'], {
    message: 'Invalid subscription tier',
  })
  tier: string;

  @ApiProperty({
    description: 'Subscription status',
    enum: ['active', 'inactive', 'cancelled', 'past_due'],
    example: 'active',
  })
  @IsEnum(['active', 'inactive', 'cancelled', 'past_due'], {
    message: 'Invalid subscription status',
  })
  status: string;

  @ApiPropertyOptional({ description: 'Subscription end date' })
  @IsOptional()
  @IsString()
  currentPeriodEnd?: string;
}

export class BulkUpdateUsersDto {
  @ApiProperty({
    description: 'Array of user IDs to update',
    type: [String],
    example: ['user-id-1', 'user-id-2'],
  })
  @IsString({ each: true })
  userIds: string[];

  @ApiProperty({ description: 'Update data to apply to all users' })
  updates: Partial<UpdateUserDto>;
}
