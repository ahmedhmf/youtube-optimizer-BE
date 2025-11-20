import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SubscriptionService } from '../../common/subscription.service';
import {
  SubscriptionTier,
  SubscriptionFeatures,
} from '../../DTO/subscription.dto';

export const SUBSCRIPTION_TIER_KEY = 'subscriptionTier';
export const FEATURE_ACCESS_KEY = 'featureAccess';

// Decorator for minimum subscription tier
export const RequireSubscriptionTier = (tier: SubscriptionTier) =>
  Reflect.metadata(SUBSCRIPTION_TIER_KEY, tier);

// Decorator for specific feature access
export const RequireFeatureAccess = (feature: keyof SubscriptionFeatures) =>
  Reflect.metadata(FEATURE_ACCESS_KEY, feature);

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required subscription tier and feature access from decorators
    const requiredTier = this.reflector.getAllAndOverride<SubscriptionTier>(
      SUBSCRIPTION_TIER_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredFeature = this.reflector.getAllAndOverride<
      keyof SubscriptionFeatures
    >(FEATURE_ACCESS_KEY, [context.getHandler(), context.getClass()]);

    // If no subscription requirements, allow access
    if (!requiredTier && !requiredFeature) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new ForbiddenException('Authentication required');
    }

    const userId = (request.user as any)?.id as string;
    if (!userId) {
      throw new ForbiddenException('User ID not found');
    }

    try {
      // Get user's current subscription
      const subscription =
        await this.subscriptionService.getUserSubscription(userId);

      // Check minimum tier requirement
      if (requiredTier) {
        const hasMinimumTier = this.checkMinimumTier(
          subscription.tier,
          requiredTier,
        );
        if (!hasMinimumTier) {
          throw new ForbiddenException(
            `This feature requires ${requiredTier} subscription or higher. Current tier: ${subscription.tier}`,
          );
        }
      }

      // Check specific feature access
      if (requiredFeature) {
        const hasFeatureAccess =
          await this.subscriptionService.checkFeatureAccess(
            userId,
            requiredFeature,
          );
        if (!hasFeatureAccess) {
          throw new ForbiddenException(
            `This feature is not available in your current subscription tier: ${subscription.tier}`,
          );
        }
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('Unable to verify subscription access');
    }
  }

  private checkMinimumTier(
    userTier: SubscriptionTier,
    requiredTier: SubscriptionTier,
  ): boolean {
    const tierHierarchy = {
      [SubscriptionTier.FREE]: 0,
      [SubscriptionTier.PRO]: 1,
      [SubscriptionTier.PREMIUM]: 2,
      [SubscriptionTier.ENTERPRISE]: 3,
    };

    return tierHierarchy[userTier] >= tierHierarchy[requiredTier];
  }
}

// Usage quota guard - checks if user has remaining usage
@Injectable()
export class UsageQuotaGuard implements CanActivate {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    if (!request.user) {
      throw new ForbiddenException('Authentication required');
    }

    const userId = (request.user as any)?.id as string;
    if (!userId) {
      throw new ForbiddenException('User ID not found');
    }

    try {
      // Check if user can perform another analysis
      const canProceed = await this.subscriptionService.incrementUsage(userId, 0); // Check without incrementing
      
      if (!canProceed) {
        const usageStats = await this.subscriptionService.getUsageStats(userId);
        throw new ForbiddenException(
          `You've reached your monthly limit of ${usageStats.features.maxAnalysesPerMonth} analyses. Please upgrade to continue.`,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('Unable to verify usage quota');
    }
  }
}