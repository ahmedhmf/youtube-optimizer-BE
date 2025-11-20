import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
  MinLength,
  IsArray,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum FeedbackType {
  BUG_REPORT = 'bug_report',
  FEATURE_REQUEST = 'feature_request',
  IMPROVEMENT = 'improvement',
  GENERAL = 'general',
  USABILITY = 'usability',
}

export enum FeedbackPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export class SubmitFeedbackDto {
  @ApiProperty({
    description: 'Type of feedback being submitted',
    enum: FeedbackType,
    example: FeedbackType.FEATURE_REQUEST,
  })
  @IsEnum(FeedbackType)
  type: FeedbackType;

  @ApiProperty({
    description: 'Title/summary of the feedback',
    example: 'Add competitor analysis feature',
    minLength: 5,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(100)
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  title: string;

  @ApiProperty({
    description: 'Detailed description of the feedback',
    example:
      'It would be great to have a feature that analyzes competitor videos.',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(1000)
  @Transform(({ value }: { value: string }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description: string;
  @ApiPropertyOptional({
    description: 'User-perceived priority of this feedback',
    enum: FeedbackPriority,
    example: FeedbackPriority.HIGH,
  })
  @IsOptional()
  @IsEnum(FeedbackPriority)
  priority?: FeedbackPriority;

  @ApiPropertyOptional({
    description: 'Tags for categorizing feedback',
    example: ['analytics', 'competitor-analysis', 'keywords'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  @Transform(({ value }: { value: any }) =>
    Array.isArray(value)
      ? value.map((tag: string) => tag?.trim()?.toLowerCase())
      : [],
  )
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Current page/feature user was using when submitting feedback',
    example: '/analyze/video',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  currentPage?: string;

  @ApiPropertyOptional({
    description: 'User agent/browser information',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;
}

export class FeatureRequestDto {
  @ApiProperty({
    description: 'Name of the requested feature',
    example: 'Performance Analytics Dashboard',
    minLength: 5,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  featureName: string;

  @ApiProperty({
    description: 'Detailed description of the feature',
    example:
      'A dashboard that shows before/after metrics of video optimization to prove ROI.',
    minLength: 20,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  description: string;

  @ApiProperty({
    description: 'Use case - why this feature is needed',
    example:
      'I want to prove to my clients that the AI suggestions actually improve video performance.',
    minLength: 10,
    maxLength: 300,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(300)
  @Transform(({ value }) => value?.trim())
  useCase: string;

  @ApiProperty({
    description: 'How important is this feature (1-10 scale)',
    example: 9,
    minimum: 1,
    maximum: 10,
  })
  @IsNumber()
  @Min(1)
  @Max(10)
  importance: number;

  @ApiPropertyOptional({
    description: 'Willingness to pay extra for this feature (1-10 scale)',
    example: 7,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  willingnessToPay?: number;

  @ApiPropertyOptional({
    description: 'Categories this feature relates to',
    example: ['analytics', 'performance', 'reporting'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  categories?: string[];
}

export class UsageTrackingDto {
  @ApiProperty({
    description: 'Feature or endpoint being used',
    example: 'analyze_youtube_video',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  feature: string;

  @ApiPropertyOptional({
    description: 'Additional metadata about the usage',
    example: { videoType: 'tutorial', language: 'en', duration: 'medium' },
  })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'How satisfied was the user with this feature (1-5 scale)',
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  satisfaction?: number;
}
