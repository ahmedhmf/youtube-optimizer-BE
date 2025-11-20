import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsDate,
  Min,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
  TRIALING = 'trialing',
  PAUSED = 'paused',
}

export enum BillingInterval {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export interface SubscriptionFeatures {
  maxAnalysesPerMonth: number;
  maxChannelsPerUser: number;
  advancedAnalytics: boolean;
  prioritySupport: boolean;
  customBranding: boolean;
  apiAccess: boolean;
  bulkOperations: boolean;
  aiSuggestionsLimit: number;
  exportFeatures: boolean;
  integrations: string[];
}

export const TIER_FEATURES: Record<SubscriptionTier, SubscriptionFeatures> = {
  [SubscriptionTier.FREE]: {
    maxAnalysesPerMonth: 10,
    maxChannelsPerUser: 1,
    advancedAnalytics: false,
    prioritySupport: false,
    customBranding: false,
    apiAccess: false,
    bulkOperations: false,
    aiSuggestionsLimit: 3,
    exportFeatures: false,
    integrations: [],
  },
  [SubscriptionTier.PRO]: {
    maxAnalysesPerMonth: 100,
    maxChannelsPerUser: 3,
    advancedAnalytics: true,
    prioritySupport: false,
    customBranding: false,
    apiAccess: true,
    bulkOperations: true,
    aiSuggestionsLimit: 10,
    exportFeatures: true,
    integrations: ['zapier', 'slack'],
  },
  [SubscriptionTier.PREMIUM]: {
    maxAnalysesPerMonth: 500,
    maxChannelsPerUser: 10,
    advancedAnalytics: true,
    prioritySupport: true,
    customBranding: true,
    apiAccess: true,
    bulkOperations: true,
    aiSuggestionsLimit: 25,
    exportFeatures: true,
    integrations: ['zapier', 'slack', 'hubspot', 'salesforce'],
  },
  [SubscriptionTier.ENTERPRISE]: {
    maxAnalysesPerMonth: -1, // Unlimited
    maxChannelsPerUser: -1, // Unlimited
    advancedAnalytics: true,
    prioritySupport: true,
    customBranding: true,
    apiAccess: true,
    bulkOperations: true,
    aiSuggestionsLimit: -1, // Unlimited
    exportFeatures: true,
    integrations: ['all'],
  },
};

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'Subscription tier to subscribe to',
    enum: SubscriptionTier,
    example: SubscriptionTier.PRO,
  })
  @IsEnum(SubscriptionTier)
  tier: SubscriptionTier;

  @ApiProperty({
    description: 'Billing interval',
    enum: BillingInterval,
    example: BillingInterval.MONTHLY,
  })
  @IsEnum(BillingInterval)
  billingInterval: BillingInterval;

  @ApiPropertyOptional({
    description: 'Promo code to apply',
    example: 'EARLY_BIRD_20',
  })
  @IsOptional()
  @IsString()
  promoCode?: string;
}

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({
    description: 'New subscription tier',
    enum: SubscriptionTier,
    example: SubscriptionTier.PREMIUM,
  })
  @IsOptional()
  @IsEnum(SubscriptionTier)
  tier?: SubscriptionTier;

  @ApiPropertyOptional({
    description: 'New billing interval',
    enum: BillingInterval,
    example: BillingInterval.YEARLY,
  })
  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;

  @ApiPropertyOptional({
    description: 'Auto-renewal setting',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}

export class SubscriptionUsageDto {
  @ApiProperty({
    description: 'Current month analyses used',
    example: 25,
  })
  @IsNumber()
  @Min(0)
  analysesUsed: number;

  @ApiProperty({
    description: 'Total analyses allowed for current tier',
    example: 100,
  })
  @IsNumber()
  @Min(-1) // -1 for unlimited
  analysesAllowed: number;

  @ApiProperty({
    description: 'Current billing period start date',
    example: '2025-11-01T00:00:00Z',
  })
  @IsDate()
  @Type(() => Date)
  billingPeriodStart: Date;

  @ApiProperty({
    description: 'Current billing period end date',
    example: '2025-11-30T23:59:59Z',
  })
  @IsDate()
  @Type(() => Date)
  billingPeriodEnd: Date;

  @ApiProperty({
    description: 'Usage percentage (0-100)',
    example: 25,
  })
  @IsNumber()
  @Min(0)
  usagePercentage: number;
}

export class BillingDetailsDto {
  @ApiProperty({
    description: 'Customer email for billing',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Customer name',
    example: 'John Doe',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Company name',
    example: 'Acme Corp',
  })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({
    description: 'Billing address',
    example: '123 Main St, New York, NY 10001',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Tax ID for business customers',
    example: 'US123456789',
  })
  @IsOptional()
  @IsString()
  taxId?: string;
}

export class SubscriptionResponse {
  @ApiProperty({
    description: 'Subscription ID',
    example: 'sub_1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'User ID',
    example: 'user_1234567890',
  })
  userId: string;

  @ApiProperty({
    description: 'Current subscription tier',
    enum: SubscriptionTier,
    example: SubscriptionTier.PRO,
  })
  tier: SubscriptionTier;

  @ApiProperty({
    description: 'Subscription status',
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @ApiProperty({
    description: 'Billing interval',
    enum: BillingInterval,
    example: BillingInterval.MONTHLY,
  })
  billingInterval: BillingInterval;

  @ApiProperty({
    description: 'Current period start date',
    example: '2025-11-01T00:00:00Z',
  })
  currentPeriodStart: Date;

  @ApiProperty({
    description: 'Current period end date',
    example: '2025-11-30T23:59:59Z',
  })
  currentPeriodEnd: Date;

  @ApiProperty({
    description: 'Auto-renewal enabled',
    example: true,
  })
  autoRenew: boolean;

  @ApiProperty({
    description: 'Subscription features',
    type: 'object',
    additionalProperties: true,
  })
  features: SubscriptionFeatures;

  @ApiProperty({
    description: 'Next billing date',
    example: '2025-12-01T00:00:00Z',
  })
  nextBillingDate?: Date;

  @ApiProperty({
    description: 'Amount in cents',
    example: 2900,
  })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  currency: string;

  @ApiProperty({
    description: 'Stripe subscription ID',
    example: 'sub_stripe_1234567890',
  })
  stripeSubscriptionId?: string;

  @ApiProperty({
    description: 'Trial end date if in trial',
    example: '2025-12-01T00:00:00Z',
  })
  trialEnd?: Date;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-11-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-11-20T12:30:00Z',
  })
  updatedAt: Date;
}

export class UsageStatsResponse {
  @ApiProperty({
    description: 'Current subscription tier',
    enum: SubscriptionTier,
    example: SubscriptionTier.PRO,
  })
  tier: SubscriptionTier;

  @ApiProperty({
    description: 'Monthly usage statistics',
    type: SubscriptionUsageDto,
  })
  monthlyUsage: SubscriptionUsageDto;

  @ApiProperty({
    description: 'Available features for current tier',
    type: 'object',
    additionalProperties: true,
  })
  features: SubscriptionFeatures;

  @ApiProperty({
    description: 'Days until next billing',
    example: 10,
  })
  daysUntilBilling: number;

  @ApiProperty({
    description: 'Whether user is approaching usage limits',
    example: false,
  })
  approachingLimits: boolean;

  @ApiProperty({
    description: 'Usage warnings if any',
    example: ['80% of monthly analyses used'],
    type: [String],
  })
  warnings: string[];
}

export class PaymentMethodDto {
  @ApiProperty({
    description: 'Stripe payment method ID',
    example: 'pm_1234567890',
  })
  @IsString()
  stripePaymentMethodId: string;

  @ApiPropertyOptional({
    description: 'Set as default payment method',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  setAsDefault?: boolean;
}
