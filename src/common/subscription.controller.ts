import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  UseGuards,
  Req,
  Logger,
  HttpStatus,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubscriptionService } from './subscription.service';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  SubscriptionResponse,
  UsageStatsResponse,
  SubscriptionTier,
} from '../DTO/subscription.dto';

@ApiTags('Subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('current')
  @ApiOperation({
    summary: 'Get current subscription',
    description:
      'Retrieve the current subscription details for the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription retrieved successfully',
    type: SubscriptionResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async getCurrentSubscription(
    @Req() req: Request,
  ): Promise<SubscriptionResponse> {
    const userId = (req.user as any)?.id as string;

    this.logger.log(`Getting subscription for user: ${userId}`);

    return this.subscriptionService.getUserSubscription(userId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create new subscription',
    description: 'Create a new subscription for the authenticated user',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Subscription created successfully',
    type: SubscriptionResponse,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid subscription data or user already has subscription',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async createSubscription(
    @Body() createSubscriptionDto: CreateSubscriptionDto,
    @Req() req: Request,
  ): Promise<SubscriptionResponse> {
    const userId = (req.user as any)?.id as string;

    this.logger.log(
      `Creating subscription for user: ${userId}, tier: ${createSubscriptionDto.tier}`,
    );

    return this.subscriptionService.createSubscription(
      userId,
      createSubscriptionDto,
    );
  }

  @Put()
  @ApiOperation({
    summary: 'Update subscription',
    description:
      'Update the current subscription (upgrade, downgrade, change billing)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription updated successfully',
    type: SubscriptionResponse,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid update data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async updateSubscription(
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
    @Req() req: Request,
  ): Promise<SubscriptionResponse> {
    const userId = (req.user as any)?.id as string;

    this.logger.log(`Updating subscription for user: ${userId}`);

    return this.subscriptionService.updateSubscription(
      userId,
      updateSubscriptionDto,
    );
  }

  @Delete()
  @ApiOperation({
    summary: 'Cancel subscription',
    description: 'Cancel the current subscription (downgrades to free tier)',
  })
  @ApiQuery({
    name: 'immediately',
    description: 'Cancel immediately or at period end',
    required: false,
    type: Boolean,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription cancelled successfully',
    type: SubscriptionResponse,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Subscription not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async cancelSubscription(
    @Query('immediately') immediately: boolean = false,
    @Req() req: Request,
  ): Promise<SubscriptionResponse> {
    const userId = (req.user as any)?.id as string;

    this.logger.log(
      `Cancelling subscription for user: ${userId}, immediately: ${immediately}`,
    );

    return this.subscriptionService.cancelSubscription(userId, immediately);
  }

  @Get('usage')
  @ApiOperation({
    summary: 'Get usage statistics',
    description: 'Retrieve current usage statistics and limits for the user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usage statistics retrieved successfully',
    type: UsageStatsResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async getUsageStats(@Req() req: Request): Promise<UsageStatsResponse> {
    const userId = (req.user as any)?.id as string;

    this.logger.log(`Getting usage stats for user: ${userId}`);

    return this.subscriptionService.getUsageStats(userId);
  }

  @Get('tiers')
  @ApiOperation({
    summary: 'Get available subscription tiers',
    description:
      'Retrieve all available subscription tiers with features and pricing',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Subscription tiers retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        tiers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tier: { type: 'string', enum: Object.values(SubscriptionTier) },
              name: { type: 'string' },
              description: { type: 'string' },
              monthlyPrice: { type: 'number' },
              yearlyPrice: { type: 'number' },
              features: {
                type: 'object',
                additionalProperties: true,
              },
              popular: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  async getSubscriptionTiers() {
    const tiers = [
      {
        tier: SubscriptionTier.FREE,
        name: 'Free',
        description: 'Perfect for getting started with YouTube optimization',
        monthlyPrice: 0,
        yearlyPrice: 0,
        features: {
          maxAnalysesPerMonth: 10,
          maxChannelsPerUser: 1,
          basicSupport: true,
          aiSuggestionsLimit: 3,
        },
        popular: false,
      },
      {
        tier: SubscriptionTier.PRO,
        name: 'Pro',
        description: 'For serious content creators and small businesses',
        monthlyPrice: 29,
        yearlyPrice: 290,
        features: {
          maxAnalysesPerMonth: 100,
          maxChannelsPerUser: 3,
          advancedAnalytics: true,
          apiAccess: true,
          bulkOperations: true,
          aiSuggestionsLimit: 10,
          exportFeatures: true,
        },
        popular: true,
      },
      {
        tier: SubscriptionTier.PREMIUM,
        name: 'Premium',
        description: 'For agencies and power users',
        monthlyPrice: 99,
        yearlyPrice: 990,
        features: {
          maxAnalysesPerMonth: 500,
          maxChannelsPerUser: 10,
          advancedAnalytics: true,
          prioritySupport: true,
          customBranding: true,
          apiAccess: true,
          bulkOperations: true,
          aiSuggestionsLimit: 25,
          exportFeatures: true,
        },
        popular: false,
      },
      {
        tier: SubscriptionTier.ENTERPRISE,
        name: 'Enterprise',
        description: 'For large organizations with custom needs',
        monthlyPrice: 199,
        yearlyPrice: 1990,
        features: {
          maxAnalysesPerMonth: -1, // Unlimited
          maxChannelsPerUser: -1, // Unlimited
          advancedAnalytics: true,
          prioritySupport: true,
          customBranding: true,
          apiAccess: true,
          bulkOperations: true,
          aiSuggestionsLimit: -1, // Unlimited
          exportFeatures: true,
          dedicatedSupport: true,
        },
        popular: false,
      },
    ];

    return { tiers };
  }

  @Post('check-usage')
  @ApiOperation({
    summary: 'Check if user can perform analysis',
    description: 'Check if user has remaining quota for video analysis',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usage check completed',
    schema: {
      type: 'object',
      properties: {
        canProceed: { type: 'boolean' },
        usageRemaining: { type: 'number' },
        upgradeRequired: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async checkUsage(@Req() req: Request) {
    const userId = (req.user as any)?.id as string;

    try {
      const canProceed = await this.subscriptionService.incrementUsage(
        userId,
        0,
      ); // Check without incrementing
      const usageStats = await this.subscriptionService.getUsageStats(userId);

      const usageRemaining =
        usageStats.features.maxAnalysesPerMonth === -1
          ? -1 // Unlimited
          : Math.max(
              0,
              usageStats.features.maxAnalysesPerMonth -
                usageStats.monthlyUsage.analysesUsed,
            );

      let message = '';
      if (!canProceed) {
        message = `You've reached your monthly limit of ${usageStats.features.maxAnalysesPerMonth} analyses. Please upgrade to continue.`;
      } else if (usageRemaining <= 3 && usageRemaining > 0) {
        message = `You have ${usageRemaining} analyses remaining this month.`;
      }

      return {
        canProceed,
        usageRemaining,
        upgradeRequired: !canProceed,
        message,
      };
    } catch (error) {
      this.logger.error('Failed to check usage:', error);
      throw new BadRequestException('Failed to check usage limits');
    }
  }

  @Post('increment-usage')
  @ApiOperation({
    summary: 'Increment usage counter',
    description:
      'Increment the usage counter after successful analysis (internal use)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usage incremented successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        newUsageCount: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Usage limit exceeded',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User not authenticated',
  })
  async incrementUsage(@Req() req: Request) {
    const userId = (req.user as any)?.id as string;

    try {
      const success = await this.subscriptionService.incrementUsage(userId, 1);

      if (!success) {
        throw new BadRequestException('Usage limit exceeded');
      }

      const usageStats = await this.subscriptionService.getUsageStats(userId);

      return {
        success: true,
        newUsageCount: usageStats.monthlyUsage.analysesUsed,
      };
    } catch (error) {
      this.logger.error('Failed to increment usage:', error);
      throw error;
    }
  }
}
