import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export interface UserContentPreferences {
  id: string;
  userId: string;
  tone?: string;
  thumbnailStyle?: string;
  imageStyle?: string;
  language?: string;
  customInstructions?: string;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class CreateContentPreferencesDto {
  @ApiProperty({
    description: 'Content tone preference',
    example: 'professional',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tone?: string;

  @ApiProperty({
    description: 'Thumbnail style preference',
    example: 'modern',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  thumbnailStyle?: string;

  @ApiProperty({
    description: 'Image style preference for AI generation',
    example: 'photorealistic',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  imageStyle?: string;

  @ApiProperty({
    description: 'Content language preference',
    example: 'en',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiProperty({
    description: 'Custom instructions for content generation',
    example: 'Always mention my brand name, avoid clickbait',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customInstructions?: string;
}

export class UpdateContentPreferencesDto {
  @ApiProperty({
    description: 'Content tone preference',
    example: 'professional',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tone?: string;

  @ApiProperty({
    description: 'Thumbnail style preference',
    example: 'modern',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  thumbnailStyle?: string;

  @ApiProperty({
    description: 'Image style preference for AI generation',
    example: 'photorealistic',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  imageStyle?: string;

  @ApiProperty({
    description: 'Content language preference',
    example: 'en',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiProperty({
    description: 'Custom instructions for content generation',
    example: 'Always mention my brand name, avoid clickbait',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customInstructions?: string;
}
