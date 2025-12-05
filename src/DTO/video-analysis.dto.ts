import {
  IsString,
  IsOptional,
  IsUrl,
  IsNotEmpty,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VideoAnalysisDto {
  @ApiProperty({
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: 'YouTube video URL',
  })
  @IsNotEmpty({ message: 'Video URL is required' })
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'Must be a valid HTTPS URL' },
  )
  @Matches(/^https:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+(&.*)?$/, {
    message: 'Must be a valid YouTube video URL',
  })
  @MaxLength(500, { message: 'URL must not exceed 500 characters' })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  videoUrl: string;

  @ApiPropertyOptional({
    example: 'en',
    description: 'Target language for analysis (ISO 639-1 code)',
  })
  @IsOptional()
  @IsString({ message: 'Language must be a string' })
  @MinLength(2, { message: 'Language code must be at least 2 characters' })
  @MaxLength(5, { message: 'Language code must not exceed 5 characters' })
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, {
    message: 'Language must be a valid ISO 639-1 code (e.g., "en", "es-ES")',
  })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  language?: string;

  @ApiPropertyOptional({
    example: 'technology',
    description: 'Content category for targeted optimization',
  })
  @IsOptional()
  @IsString({ message: 'Category must be a string' })
  @MinLength(2, { message: 'Category must be at least 2 characters' })
  @MaxLength(50, { message: 'Category must not exceed 50 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_]+$/, {
    message:
      'Category can only contain letters, numbers, spaces, hyphens, and underscores',
  })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  category?: string;
}

export class TranscriptUploadDto {
  @ApiProperty({
    example: 'Hello everyone, welcome to my channel...',
    description: 'Video transcript text',
  })
  @IsNotEmpty({ message: 'Transcript content is required' })
  @IsString({ message: 'Transcript must be a string' })
  @MinLength(50, { message: 'Transcript must be at least 50 characters long' })
  @MaxLength(50000, { message: 'Transcript must not exceed 50,000 characters' })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  content: string;

  @ApiPropertyOptional({
    example: 'en',
    description: 'Transcript language (ISO 639-1 code)',
  })
  @IsOptional()
  @IsString({ message: 'Language must be a string' })
  @MinLength(2, { message: 'Language code must be at least 2 characters' })
  @MaxLength(5, { message: 'Language code must not exceed 5 characters' })
  @Matches(/^[a-z]{2}(-[A-Z]{2})?$/, {
    message: 'Language must be a valid ISO 639-1 code',
  })
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  language?: string;
}
