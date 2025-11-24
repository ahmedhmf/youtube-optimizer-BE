import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum OnboardingStep {
  WELCOME = 'welcome',
  USER_TYPE = 'user_type',
  FIRST_ANALYSIS = 'first_analysis',
  FEATURES_TOUR = 'features_tour',
  PREFERENCES = 'preferences',
  COMPLETED = 'completed',
}

export enum UserType {
  CREATOR = 'creator',
  MARKETER = 'marketer',
  AGENCY = 'agency',
  BUSINESS = 'business',
  OTHER = 'other',
}

export enum ContentCategory {
  EDUCATION = 'education',
  ENTERTAINMENT = 'entertainment',
  GAMING = 'gaming',
  TECH = 'tech',
  BUSINESS = 'business',
  LIFESTYLE = 'lifestyle',
  MUSIC = 'music',
  SPORTS = 'sports',
  OTHER = 'other',
}

export class StartOnboardingDto {
  @ApiProperty({
    description: "User's name for personalization",
    example: 'John Doe',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: "Optional: User's channel/brand name",
    example: 'TechTips Channel',
    required: false,
  })
  @IsOptional()
  @IsString()
  channelName?: string;
  contentType: any;
  goals: any;
}

export class UpdateUserTypeDto {
  @ApiProperty({
    description: 'Type of user for tailored experience',
    enum: UserType,
    example: UserType.CREATOR,
  })
  @IsEnum(UserType)
  userType: UserType;

  @ApiProperty({
    description: 'Primary content categories',
    enum: ContentCategory,
    isArray: true,
    example: [ContentCategory.TECH, ContentCategory.EDUCATION],
  })
  @IsArray()
  @IsEnum(ContentCategory, { each: true })
  contentCategories: ContentCategory[];

  @ApiProperty({
    description: 'Monthly video upload frequency',
    example: 8,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  monthlyVideoCount: number;
}

export class CompleteFirstAnalysisDto {
  @ApiProperty({
    description: 'The video URL or job ID that was analyzed',
    example: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
  })
  @IsString()
  videoReference: string;

  @ApiProperty({
    description: 'User rating of the analysis quality',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  analysisRating: number;

  @ApiProperty({
    description: 'Optional feedback about the analysis',
    required: false,
  })
  @IsOptional()
  @IsString()
  feedback?: string;
}

export class UpdatePreferencesDto {
  @ApiProperty({
    description: 'Preferred AI tone for suggestions',
    example: 'professional',
    enum: ['casual', 'professional', 'creative', 'data-driven'],
  })
  @IsEnum(['casual', 'professional', 'creative', 'data-driven'])
  preferredTone: string;

  @ApiProperty({
    description: 'Target audience for content',
    example: 'young-adults',
    enum: ['children', 'teens', 'young-adults', 'adults', 'seniors', 'all'],
  })
  @IsEnum(['children', 'teens', 'young-adults', 'adults', 'seniors', 'all'])
  targetAudience: string;

  @ApiProperty({
    description: 'Enable email notifications for tips and updates',
    example: true,
  })
  @IsBoolean()
  emailNotifications: boolean;

  @ApiProperty({
    description: 'Enable browser notifications for completed analyses',
    example: true,
  })
  @IsBoolean()
  browserNotifications: boolean;
}

export class OnboardingProgressResponse {
  @ApiProperty({
    description: 'Current step in onboarding',
    enum: OnboardingStep,
    example: OnboardingStep.USER_TYPE,
  })
  currentStep: OnboardingStep;

  @ApiProperty({
    description: 'Progress percentage (0-100)',
    example: 40,
  })
  progressPercentage: number;

  @ApiProperty({
    description: 'Steps completed',
    type: [String],
    example: [OnboardingStep.WELCOME, OnboardingStep.USER_TYPE],
  })
  completedSteps: OnboardingStep[];

  @ApiProperty({
    description: 'Next recommended action',
    example: 'Try analyzing your first YouTube video to see AI suggestions!',
  })
  nextAction: string;

  @ApiProperty({
    description: 'Estimated time to complete onboarding',
    example: '3 minutes remaining',
  })
  estimatedTimeRemaining: string;
}
