import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import Stripe from 'stripe';
import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingInterval,
  SubscriptionFeatures,
  TIER_FEATURES,
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  SubscriptionResponse,
  UsageStatsResponse,
  SubscriptionUsageDto,
  BillingDetailsDto,
  PaymentMethodDto,
} from '../DTO/subscription.dto';

interface SubscriptionData {
  id?: string;
  user_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billing_interval: BillingInterval;
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  amount: number;
  currency: string;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  trial_end?: string;
  cancelled_at?: string;
  created_at?: string;
  updated_at?: string;
}

interface UsageData {
  id?: string;
  user_id: string;
  analyses_used_current_month: number;
  billing_period_start: string;
  billing_period_end: string;
  last_reset_date: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly stripe: Stripe;

  constructor(private readonly supabaseService: SupabaseService) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      this.logger.warn('Stripe secret key not configured - billing features will be disabled');
    } else {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2024-10-28.acacia',
      });
    }
  }

  async getUserSubscription(userId: string): Promise<SubscriptionResponse> {
    try {
      const client = this.supabaseService.getServiceClient();

      const { data, error } = (await client
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single()) as { data: SubscriptionData | null; error: any };

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) {
        // Return free tier default subscription
        return this.createDefaultFreeSubscription(userId);
      }

      return this.mapToSubscriptionResponse(data);
    } catch (error) {
      this.logger.error('Failed to get user subscription:', error);
      throw error;
    }
  }

  async createSubscription(
    userId: string,
    createDto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponse> {
    try {
      const client = this.supabaseService.getServiceClient();

      // Check if user already has a subscription
      const existingSubscription = await this.getUserSubscription(userId);
      if (existingSubscription.tier !== SubscriptionTier.FREE) {
        throw new BadRequestException('User already has an active subscription');
      }

      // Create Stripe subscription if not free tier
      let stripeSubscription = null;
      let stripeCustomerId = null;

      if (createDto.tier !== SubscriptionTier.FREE && this.stripe) {
        const { data: userData } = await client
          .from('user_profiles')
          .select('email, name, stripe_customer_id')
          .eq('user_id', userId)
          .single();

        if (!userData) {
          throw new NotFoundException('User profile not found');
        }

        // Create or retrieve Stripe customer
        if (userData.stripe_customer_id) {
          stripeCustomerId = userData.stripe_customer_id;
        } else {
          const customer = await this.stripe.customers.create({
            email: userData.email,
            name: userData.name,
            metadata: { userId },
          });
          stripeCustomerId = customer.id;

          // Update user profile with Stripe customer ID
          await client
            .from('user_profiles')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('user_id', userId);
        }

        // Create subscription in Stripe
        const priceId = this.getPriceId(createDto.tier, createDto.billingInterval);
        stripeSubscription = await this.stripe.subscriptions.create({
          customer: stripeCustomerId,
          items: [{ price: priceId }],
          metadata: { userId, tier: createDto.tier },
          trial_period_days: createDto.tier === SubscriptionTier.PRO ? 14 : undefined,
        });
      }

      const now = new Date();
      const currentPeriodEnd = new Date(now);
      currentPeriodEnd.setMonth(
        currentPeriodEnd.getMonth() + 
        (createDto.billingInterval === BillingInterval.YEARLY ? 12 : 1)
      );

      const subscriptionData: Partial<SubscriptionData> = {
        user_id: userId,
        tier: createDto.tier,
        status: stripeSubscription?.status as SubscriptionStatus || SubscriptionStatus.ACTIVE,
        billing_interval: createDto.billingInterval,
        current_period_start: now.toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        auto_renew: true,
        amount: this.getTierPrice(createDto.tier, createDto.billingInterval),
        currency: 'USD',
        stripe_subscription_id: stripeSubscription?.id,
        stripe_customer_id: stripeCustomerId,
        trial_end: stripeSubscription?.trial_end 
          ? new Date(stripeSubscription.trial_end * 1000).toISOString()
          : undefined,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      const { data, error } = await client
        .from('user_subscriptions')
        .insert([subscriptionData])
        .select()
        .single();

      if (error) throw error;

      // Initialize usage tracking
      await this.initializeUsageTracking(userId);

      this.logger.log(`Subscription created for user ${userId}: ${createDto.tier}`);
      return this.mapToSubscriptionResponse(data);
    } catch (error) {
      this.logger.error('Failed to create subscription:', error);
      throw error;
    }
  }

  async updateSubscription(
    userId: string,
    updateDto: UpdateSubscriptionDto,
  ): Promise<SubscriptionResponse> {
    try {
      const client = this.supabaseService.getServiceClient();

      const currentSubscription = await this.getUserSubscription(userId);
      
      const updateData: Partial<SubscriptionData> = {
        updated_at: new Date().toISOString(),
      };

      if (updateDto.tier) {
        updateData.tier = updateDto.tier;
        updateData.amount = this.getTierPrice(
          updateDto.tier,
          updateDto.billingInterval || currentSubscription.billingInterval,
        );

        // Update Stripe subscription if needed
        if (this.stripe && currentSubscription.stripeSubscriptionId) {
          const priceId = this.getPriceId(
            updateDto.tier,
            updateDto.billingInterval || currentSubscription.billingInterval,
          );

          await this.stripe.subscriptions.update(
            currentSubscription.stripeSubscriptionId,
            {
              items: [{
                id: (await this.stripe.subscriptions.retrieve(
                  currentSubscription.stripeSubscriptionId,
                )).items.data[0].id,
                price: priceId,
              }],
            },
          );
        }
      }

      if (updateDto.billingInterval) {
        updateData.billing_interval = updateDto.billingInterval;
      }

      if (updateDto.autoRenew !== undefined) {
        updateData.auto_renew = updateDto.autoRenew;
      }

      const { data, error } = await client
        .from('user_subscriptions')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      this.logger.log(`Subscription updated for user ${userId}`);
      return this.mapToSubscriptionResponse(data);
    } catch (error) {
      this.logger.error('Failed to update subscription:', error);
      throw error;
    }
  }

  async cancelSubscription(userId: string, cancelImmediately = false): Promise<SubscriptionResponse> {
    try {
      const client = this.supabaseService.getServiceClient();
      const subscription = await this.getUserSubscription(userId);

      // Cancel in Stripe if exists
      if (this.stripe && subscription.stripeSubscriptionId) {
        await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: !cancelImmediately,
        });

        if (cancelImmediately) {
          await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        }
      }

      const updateData: Partial<SubscriptionData> = {
        status: cancelImmediately ? SubscriptionStatus.CANCELLED : SubscriptionStatus.ACTIVE,
        auto_renew: false,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (cancelImmediately) {
        updateData.tier = SubscriptionTier.FREE;
        updateData.current_period_end = new Date().toISOString();
      }

      const { data, error } = await client
        .from('user_subscriptions')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      this.logger.log(`Subscription cancelled for user ${userId}`);
      return this.mapToSubscriptionResponse(data);
    } catch (error) {
      this.logger.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  async getUsageStats(userId: string): Promise<UsageStatsResponse> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const usage = await this.getUserUsage(userId);
      const features = TIER_FEATURES[subscription.tier];

      const daysUntilBilling = Math.ceil(
        (subscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );

      const usagePercentage = features.maxAnalysesPerMonth === -1
        ? 0
        : Math.round((usage.analysesUsed / features.maxAnalysesPerMonth) * 100);

      const approachingLimits = usagePercentage > 80;
      const warnings: string[] = [];

      if (usagePercentage > 90) {
        warnings.push(`${usagePercentage}% of monthly analyses used`);
      }

      if (daysUntilBilling <= 3 && !subscription.autoRenew) {
        warnings.push('Subscription expires in 3 days');
      }

      return {
        tier: subscription.tier,
        monthlyUsage: usage,
        features,
        daysUntilBilling,
        approachingLimits,
        warnings,
      };
    } catch (error) {
      this.logger.error('Failed to get usage stats:', error);
      throw error;
    }
  }

  async incrementUsage(userId: string, analysisCount = 1): Promise<boolean> {
    try {
      const client = this.supabaseService.getServiceClient();
      const subscription = await this.getUserSubscription(userId);
      const features = TIER_FEATURES[subscription.tier];

      // Check if user has unlimited analyses
      if (features.maxAnalysesPerMonth === -1) {
        return true;
      }

      const usage = await this.getUserUsage(userId);

      // Check if user would exceed limit
      if (usage.analysesUsed + analysisCount > features.maxAnalysesPerMonth) {
        return false;
      }

      // Increment usage
      const { error } = await client
        .from('user_usage')
        .update({
          analyses_used_current_month: usage.analysesUsed + analysisCount,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;

      return true;
    } catch (error) {
      this.logger.error('Failed to increment usage:', error);
      throw error;
    }
  }

  async checkFeatureAccess(userId: string, feature: keyof SubscriptionFeatures): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const features = TIER_FEATURES[subscription.tier];
      
      return Boolean(features[feature]);
    } catch (error) {
      this.logger.error('Failed to check feature access:', error);
      return false;
    }
  }

  private async createDefaultFreeSubscription(userId: string): Promise<SubscriptionResponse> {
    const now = new Date();
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    return {
      id: `free_${userId}`,
      userId,
      tier: SubscriptionTier.FREE,
      status: SubscriptionStatus.ACTIVE,
      billingInterval: BillingInterval.MONTHLY,
      currentPeriodStart: now,
      currentPeriodEnd: oneYearFromNow,
      autoRenew: true,
      features: TIER_FEATURES[SubscriptionTier.FREE],
      amount: 0,
      currency: 'USD',
      createdAt: now,
      updatedAt: now,
    };
  }

  private async getUserUsage(userId: string): Promise<SubscriptionUsageDto> {
    const client = this.supabaseService.getServiceClient();

    const { data, error } = (await client
      .from('user_usage')
      .select('*')
      .eq('user_id', userId)
      .single()) as { data: UsageData | null; error: any };

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      // Initialize usage tracking
      await this.initializeUsageTracking(userId);
      return this.getUserUsage(userId);
    }

    // Reset usage if billing period has passed
    const now = new Date();
    const billingPeriodEnd = new Date(data.billing_period_end);

    if (now > billingPeriodEnd) {
      await this.resetMonthlyUsage(userId);
      return this.getUserUsage(userId);
    }

    const subscription = await this.getUserSubscription(userId);
    const features = TIER_FEATURES[subscription.tier];

    return {
      analysesUsed: data.analyses_used_current_month,
      analysesAllowed: features.maxAnalysesPerMonth,
      billingPeriodStart: new Date(data.billing_period_start),
      billingPeriodEnd: new Date(data.billing_period_end),
      usagePercentage: features.maxAnalysesPerMonth === -1
        ? 0
        : Math.round((data.analyses_used_current_month / features.maxAnalysesPerMonth) * 100),
    };
  }

  private async initializeUsageTracking(userId: string): Promise<void> {
    const client = this.supabaseService.getServiceClient();
    const now = new Date();
    const billingPeriodEnd = new Date(now);
    billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);

    const usageData: Partial<UsageData> = {
      user_id: userId,
      analyses_used_current_month: 0,
      billing_period_start: now.toISOString(),
      billing_period_end: billingPeriodEnd.toISOString(),
      last_reset_date: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const { error } = await client
      .from('user_usage')
      .upsert([usageData]);

    if (error) throw error;
  }

  private async resetMonthlyUsage(userId: string): Promise<void> {
    const client = this.supabaseService.getServiceClient();
    const now = new Date();
    const billingPeriodEnd = new Date(now);
    billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);

    const { error } = await client
      .from('user_usage')
      .update({
        analyses_used_current_month: 0,
        billing_period_start: now.toISOString(),
        billing_period_end: billingPeriodEnd.toISOString(),
        last_reset_date: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId);

    if (error) throw error;
  }

  private mapToSubscriptionResponse(data: SubscriptionData): SubscriptionResponse {
    return {
      id: data.id || '',
      userId: data.user_id,
      tier: data.tier,
      status: data.status,
      billingInterval: data.billing_interval,
      currentPeriodStart: new Date(data.current_period_start),
      currentPeriodEnd: new Date(data.current_period_end),
      autoRenew: data.auto_renew,
      features: TIER_FEATURES[data.tier],
      nextBillingDate: data.auto_renew ? new Date(data.current_period_end) : undefined,
      amount: data.amount,
      currency: data.currency,
      stripeSubscriptionId: data.stripe_subscription_id,
      trialEnd: data.trial_end ? new Date(data.trial_end) : undefined,
      createdAt: new Date(data.created_at || ''),
      updatedAt: new Date(data.updated_at || ''),
    };
  }

  private getTierPrice(tier: SubscriptionTier, interval: BillingInterval): number {
    const prices = {
      [SubscriptionTier.FREE]: { monthly: 0, yearly: 0 },
      [SubscriptionTier.PRO]: { monthly: 2900, yearly: 29000 }, // $29/month, $290/year
      [SubscriptionTier.PREMIUM]: { monthly: 9900, yearly: 99000 }, // $99/month, $990/year
      [SubscriptionTier.ENTERPRISE]: { monthly: 19900, yearly: 199000 }, // $199/month, $1990/year
    };

    return interval === BillingInterval.YEARLY
      ? prices[tier].yearly
      : prices[tier].monthly;
  }

  private getPriceId(tier: SubscriptionTier, interval: BillingInterval): string {
    // In production, these would be actual Stripe price IDs
    const priceIds = {
      [SubscriptionTier.PRO]: {
        monthly: 'price_pro_monthly',
        yearly: 'price_pro_yearly',
      },
      [SubscriptionTier.PREMIUM]: {
        monthly: 'price_premium_monthly',
        yearly: 'price_premium_yearly',
      },
      [SubscriptionTier.ENTERPRISE]: {
        monthly: 'price_enterprise_monthly',
        yearly: 'price_enterprise_yearly',
      },
    };

    return priceIds[tier]?.[interval] || 'price_default';
  }
}