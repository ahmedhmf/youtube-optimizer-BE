import {
  IsString,
  IsOptional,
  IsUrl,
  IsNotEmpty,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyzeVideoByUrlDto {
  @ApiProperty({
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: 'YouTube video URL to analyze',
  })
  @IsNotEmpty({ message: 'Video URL is required' })
  @IsUrl({}, { message: 'Must be a valid URL' })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  videoUrl: string;

  @ApiPropertyOptional({
    example: 'en',
    description: 'Target language for titles (default: en)',
    default: 'en',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(5)
  language?: string;

  @ApiPropertyOptional({
    example: 'professional',
    description: 'Tone for titles (e.g., professional, casual, energetic)',
    default: 'professional',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tone?: string;
}

export class AnalyzeVideoByTextDto {
  @ApiProperty({
    example: 'This is the video transcript text...',
    description: 'Video transcript text to analyze',
  })
  @IsNotEmpty({ message: 'Transcript text is required' })
  @IsString()
  @MinLength(100, { message: 'Transcript must be at least 100 characters' })
  @MaxLength(100000, {
    message: 'Transcript must not exceed 100,000 characters',
  })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  transcript: string;

  @ApiPropertyOptional({
    example: 'My Original Video Title',
    description: 'Original video title for context',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  originalTitle?: string;

  @ApiPropertyOptional({
    example: 'en',
    description: 'Target language for titles (default: en)',
    default: 'en',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(5)
  language?: string;

  @ApiPropertyOptional({
    example: 'professional',
    description: 'Tone for titles (e.g., professional, casual, energetic)',
    default: 'professional',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tone?: string;
}

export class AnalyzeVideoByFileDto {
  @ApiPropertyOptional({
    example: 'My Original Video Title',
    description: 'Original video title for context',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  originalTitle?: string;

  @ApiPropertyOptional({
    example: 'en',
    description: 'Target language for titles (default: en)',
    default: 'en',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(5)
  language?: string;

  @ApiPropertyOptional({
    example: 'professional',
    description: 'Tone for titles (e.g., professional, casual, energetic)',
    default: 'professional',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tone?: string;
}
