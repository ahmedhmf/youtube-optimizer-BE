import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from 'src/supabase/supabase.service';
import { LogAggregatorService } from '../logging/services/log-aggregator.service';
import { SocialProvider } from '../auth/dto';
import { UserRole } from '../auth/types/roles.types';
import {
  AllUserInformation,
  UserInformation,
} from './model/all-user-information.type';
import { UpdateUserDto } from './dto/update-user-info.dto';
import { Profile } from 'src/auth/types/profiles.type';
import { UsageOverviewDto } from './dto/usage-overview.dto';
import { UserUsageToken } from './model/user-usage-tokens.type';
import { UserActivities } from './model/user-activities.type';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly logAggregatorService: LogAggregatorService,
  ) {}

  /**
   * Get all users with pagination and comprehensive data (Admin only)
   */
  public async getAllUsers(
    options: {
      page?: number;
      limit?: number;
      search?: string;
      role?: UserRole;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {},
  ): Promise<{
    users: Array<AllUserInformation>;
    total: number;
    page: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const offset = (page - 1) * limit;
    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'desc';

    const client = this.supabase.getServiceClient();

    try {
      // Build base query for profiles
      let baseQuery = client.from('profiles').select('*', { count: 'exact' });

      // Apply search filter
      if (options.search?.trim()) {
        const searchTerm = `%${options.search.trim()}%`;
        baseQuery = baseQuery.or(
          `email.ilike.${searchTerm},name.ilike.${searchTerm}`,
        );
      }

      // Apply role filter
      if (options.role) {
        baseQuery = baseQuery.eq('role', options.role);
      }

      // Get total count
      const { count: totalCount, error: countError } = await baseQuery;
      if (countError) {
        throw new Error(`Failed to get user count: ${countError.message}`);
      }

      // Get paginated data
      const { data: profiles, error: profilesError } = await baseQuery
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      if (profilesError) {
        throw new Error(`Failed to fetch users: ${profilesError.message}`);
      }

      const total = totalCount || 0;
      const totalPages = Math.ceil(total / limit);

      // Get additional data for each user
      const enrichedUsers = await Promise.all(
        (profiles || []).map(async (profile: Profile) => {
          const userId = profile.id;

          // Get subscription data
          const { data: subscription } = await client
            .from('user_subscriptions')
            .select('tier, status, current_period_end')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single()
            .then((res) => ({
              data: res.data as {
                tier: string;
                status: string;
                current_period_end: string;
              } | null,
              error: res.error,
            }));

          // Get onboarding data
          const { data: onboarding } = await client
            .from('user_onboarding')
            .select('current_step, completed_steps, completed_at')
            .eq('user_id', userId)
            .single()
            .then((res) => ({
              data: res.data as {
                current_step: string;
                completed_steps: string[];
                completed_at: string;
              } | null,
              error: res.error,
            }));

          // Get last activity from sessions
          const { data: lastSession } = await client
            .from('user_sessions')
            .select('last_activity')
            .eq('user_id', userId)
            .order('last_activity', { ascending: false })
            .limit(1)
            .single()
            .then((res) => ({
              data: res.data as { last_activity: string } | null,
              error: res.error,
            }));

          // Get total analyses count
          const { count: totalAnalyses } = await client
            .from('audits')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .then((res) => ({ count: res.count, error: res.error }));

          // Calculate onboarding progress
          const completedSteps = Array.isArray(onboarding?.completed_steps)
            ? onboarding.completed_steps.length
            : 0;
          const totalSteps = 5; // Total onboarding steps
          const progressPercentage = Math.round(
            (completedSteps / totalSteps) * 100,
          );

          // Determine account status (Supabase Auth handles lockouts now)
          let accountStatus: 'active' | 'locked' | 'inactive' = 'active';
          if (!lastSession?.last_activity) {
            accountStatus = 'inactive';
          }

          const user: AllUserInformation = {
            id: profile.id,
            email: profile.email,
            name: profile.name || '',
            role: this.getUserRoleFromString(profile.role),
            picture: profile.picture || '',
            provider: this.getValidProvider(profile.provider),
            createdAt: new Date(profile.created_at ?? ''),
            updatedAt: new Date(profile.updated_at ?? ''),
            subscription: subscription
              ? {
                  tier: subscription.tier || 'free',
                  status: subscription.status || 'inactive',
                  currentPeriodEnd: subscription.current_period_end
                    ? new Date(subscription.current_period_end)
                    : undefined,
                }
              : {
                  tier: 'free',
                  status: 'inactive',
                },
            onboarding: {
              currentStep: onboarding?.current_step || 'welcome',
              progressPercentage,
              completedAt: onboarding?.completed_at
                ? new Date(onboarding.completed_at)
                : undefined,
            },
            lastActivity: lastSession?.last_activity
              ? new Date(lastSession.last_activity)
              : undefined,
            totalAnalyses: totalAnalyses || 0,
            accountStatus,
          };

          return user;
        }),
      );

      return {
        users: enrichedUsers,
        total,
        page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      this.logger.error('Error fetching all users:', error);
      throw new Error(
        `Failed to fetch users: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getUserProfile(userId: string): Promise<UserInformation> {
    const client = this.supabase.getClient();
    const { data: profile, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single<Profile>();

    if (error) {
      throw new UnauthorizedException(`Database error: ${error.message}`);
    }

    if (!profile) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name ?? '',
      role: this.getUserRoleFromString(profile.role),
      picture: profile.picture ?? '',
      provider: this.getValidProvider(profile.provider),
      createdAt: new Date(profile.created_at ?? ''),
      updatedAt: new Date(profile.updated_at ?? ''),
    };
  }

  /**
   * Get user by ID (Admin only)
   */
  public async getUserById(userId: string): Promise<AllUserInformation> {
    try {
      const client = this.supabase.getServiceClient();
      const { data: profile } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single<Profile>();

      if (!profile) {
        throw new Error('User not found');
      }

      // Get subscription data
      const { data: subscription } = (await client
        .from('user_subscriptions')
        .select('tier, status, current_period_end')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()) as {
        data: {
          tier: string;
          status: string;
          current_period_end: string;
        } | null;
      };

      // Get onboarding data
      const { data: onboarding } = (await client
        .from('user_onboarding')
        .select('current_step, progress_percentage, completed_at')
        .eq('user_id', userId)
        .single()) as {
        data: {
          current_step: string;
          progress_percentage: number;
          completed_at: string;
        } | null;
      };

      return {
        id: profile.id,
        email: profile.email || '',
        name: profile.name || '',
        role: this.getUserRoleFromString(profile.role),
        provider: this.getValidProvider(profile.provider),
        accountStatus: 'active' as 'active' | 'locked' | 'inactive',
        lastActivity: undefined,
        subscription: subscription
          ? {
              tier: subscription.tier,
              status: subscription.status,
              currentPeriodEnd: new Date(subscription.current_period_end),
            }
          : undefined,
        onboarding: onboarding
          ? {
              currentStep: onboarding.current_step,
              progressPercentage: onboarding.progress_percentage || 0,
              completedAt: onboarding.completed_at
                ? new Date(onboarding.completed_at)
                : undefined,
            }
          : undefined,
        picture: profile.picture ?? undefined,
        createdAt: new Date(profile.created_at ?? ''),
        updatedAt: new Date(profile.updated_at ?? ''),
      };
    } catch (error) {
      this.logger.error(`Error fetching user ${userId}:`, error);
      throw new Error(
        `Failed to fetch user: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Update user profile information (Admin only)
   */
  public async updateUser(
    userId: string,
    updateData: UpdateUserDto,
    adminId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AllUserInformation> {
    const client = this.supabase.getServiceClient();

    try {
      this.logger.log(
        `Admin ${adminId} updating user ${userId} with data:`,
        updateData,
      );

      // Check if user exists and get current state
      const { data: existingUser, error: fetchError } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single<Profile>();

      if (fetchError || !existingUser) {
        throw new Error('User not found');
      }

      // Get admin info for audit trail
      const { data: adminProfile } = await client
        .from('profiles')
        .select('email, role')
        .eq('id', adminId)
        .single<{ email: string; role: string }>();

      // Capture old values for audit trail
      const oldValues: Record<string, unknown> = {};
      const newValues: Record<string, unknown> = {};
      const changes: string[] = [];

      // Prepare update data (only include fields that are provided)
      const profileUpdates: Partial<Profile> & { updated_at: string } = {
        updated_at: new Date().toISOString(),
      };

      if (
        updateData.email !== undefined &&
        updateData.email !== existingUser.email
      ) {
        // Check if email is already taken by another user
        const { data: emailCheck } = await client
          .from('profiles')
          .select('id')
          .eq('email', updateData.email)
          .neq('id', userId)
          .single();

        if (emailCheck) {
          throw new Error('Email is already in use by another user');
        }
        profileUpdates.email = updateData.email;
        oldValues.email = existingUser.email;
        newValues.email = updateData.email;
        changes.push('email');
      }

      if (
        updateData.name !== undefined &&
        updateData.name !== existingUser.name
      ) {
        profileUpdates.name = updateData.name;
        oldValues.name = existingUser.name;
        newValues.name = updateData.name;
        changes.push('name');
      }

      if (
        updateData.role !== undefined &&
        updateData.role !== existingUser.role
      ) {
        profileUpdates.role = updateData.role;
        oldValues.role = existingUser.role;
        newValues.role = updateData.role;
        changes.push('role');
      }

      if (
        updateData.picture !== undefined &&
        updateData.picture !== existingUser.picture
      ) {
        profileUpdates.picture = updateData.picture;
        oldValues.picture = existingUser.picture;
        newValues.picture = updateData.picture;
        changes.push('picture');
      }

      // Update profile
      const { data: updatedProfile, error: updateError } = await client
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId)
        .select()
        .single<Profile>();

      if (updateError) {
        throw new Error(`Failed to update user: ${updateError.message}`);
      }

      // Account lockout is now handled by Supabase Auth
      // Admin can disable users through Supabase dashboard if needed
      if (updateData.accountStatus === 'locked') {
        this.logger.warn(
          `Account lockout requested for ${existingUser.email} - use Supabase dashboard to disable user`,
        );
      }

      // Log admin action to old admin_audit_log table
      await this.logAdminAction(adminId, 'update_user', userId, {
        updates: updateData,
        previousData: {
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role,
        },
      });

      // Log to audit trail if there are actual changes
      if (changes.length > 0) {
        await this.logAggregatorService.logAuditTrail({
          actorId: adminId,
          actorEmail: adminProfile?.email || 'unknown',
          actorRole: adminProfile?.role || 'unknown',
          action: 'update_user_profile',
          entityType: 'user',
          entityId: userId,
          oldValues,
          newValues,
          changes,
          ipAddress: ipAddress || 'unknown',
          userAgent: userAgent || 'unknown',
          metadata: {
            targetUserEmail: existingUser.email,
            targetUserName: existingUser.name,
            updatedBy: adminId,
            updateTimestamp: new Date().toISOString(),
          },
        });
      }

      // Return updated user with full information
      const users = await this.getAllUsers({
        page: 1,
        limit: 1,
        search: updatedProfile.email,
      });

      if (!users.users.length) {
        throw new Error('Failed to fetch updated user data');
      }

      this.logger.log(`Successfully updated user ${userId}`);
      return users.users[0];
    } catch (error) {
      this.logger.error(`Error updating user ${userId}:`, error);
      throw new Error(
        `Failed to update user: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Add to admin.service.ts

  /**
   * Get comprehensive usage overview for a user (Admin only)
   */
  public async getUserUsageOverview(userId: string): Promise<UsageOverviewDto> {
    const client = this.supabase.getServiceClient();

    try {
      this.logger.log(`Fetching usage overview for user ${userId}`);

      // Get user profile
      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('id, email, name')
        .eq('id', userId)
        .single<Profile>();

      if (profileError || !profile) {
        throw new Error('User not found');
      }

      // Get subscription info
      const { data: subscription } = (await client
        .from('user_subscriptions')
        .select('tier, status, current_period_start, current_period_end')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()) as {
        data: {
          tier: string;
          status: string;
          current_period_start: string;
          current_period_end: string;
        } | null;
      };

      const subscriptionTier = subscription?.tier || 'free';

      // Get subscription limits
      const { data: limits } = (await client
        .from('subscription_limits')
        .select('*')
        .eq('tier', subscriptionTier)
        .single()) as { data: Record<string, unknown> | null };

      // Calculate current billing period
      const now = new Date();
      const periodStart = subscription?.current_period_start
        ? new Date(subscription.current_period_start)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = subscription?.current_period_end
        ? new Date(subscription.current_period_end)
        : new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const daysRemaining = Math.max(
        0,
        Math.ceil(
          (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );

      // Get video analysis data
      const videoAnalysisData = await this.getVideoAnalysisUsage(
        userId,
        periodStart,
        periodEnd,
        limits,
      );

      // Get token usage data
      const tokenUsageData = await this.getTokenUsage(
        userId,
        periodStart,
        periodEnd,
        limits,
      );

      // Get API calls data
      const apiCallsData = await this.getApiCallsUsage(
        userId,
        periodStart,
        periodEnd,
        limits,
      );

      // Get recent activities
      const recentActivities = await this.getRecentActivities(userId, 20);

      // Get video analysis history
      const videoAnalysisHistory = await this.getVideoAnalysisHistory(
        userId,
        50,
      );

      const usageOverview: UsageOverviewDto = {
        userId: profile.id,
        email: profile.email,
        name: profile.name || '',
        subscriptionTier,
        videoAnalysis: videoAnalysisData,
        tokens: tokenUsageData,
        apiCalls: apiCallsData,
        recentActivities,
        videoAnalysisHistory,
        period: {
          startDate: periodStart,
          endDate: periodEnd,
          daysRemaining,
        },
      };

      return usageOverview;
    } catch (error) {
      this.logger.error(
        `Error fetching usage overview for user ${userId}:`,
        error,
      );
      throw new Error(
        `Failed to fetch usage overview: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get video analysis usage statistics
   */
  private async getVideoAnalysisUsage(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    limits: Record<string, unknown> | null,
  ): Promise<UsageOverviewDto['videoAnalysis']> {
    const client = this.supabase.getServiceClient();

    // Get total analyzed videos (all time)
    const { count: totalAnalyzed } = await client
      .from('audits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get monthly analyzed videos
    const { count: monthlyAnalyzed } = await client
      .from('audits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString());

    const limit = (limits?.video_analysis_limit as number) || 5;
    const unlimited = limit === -1;
    const remaining = unlimited
      ? Infinity
      : Math.max(0, limit - (monthlyAnalyzed || 0));
    const percentageUsed = unlimited
      ? 0
      : Math.min(100, ((monthlyAnalyzed || 0) / limit) * 100);

    return {
      totalAnalyzed: totalAnalyzed || 0,
      monthlyAnalyzed: monthlyAnalyzed || 0,
      limit: unlimited ? -1 : limit,
      remaining: unlimited ? -1 : remaining,
      percentageUsed: Math.round(percentageUsed * 100) / 100,
    };
  }

  /**
   * Get token usage statistics
   */
  private async getTokenUsage(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    limits: Record<string, unknown> | null,
  ): Promise<UsageOverviewDto['tokens']> {
    const client = this.supabase.getServiceClient();

    // Get total tokens used (all time)
    const { data: totalTokenData } = await client
      .from('user_token_usage')
      .select('tokens_consumed')
      .eq('user_id', userId);

    const totalUsed = (totalTokenData || []).reduce(
      (sum: number, record: UserUsageToken) => sum + record.tokens_consumed,
      0,
    );

    // Get monthly tokens used
    const { data: monthlyTokenData } = await client
      .from('user_token_usage')
      .select('tokens_consumed, feature_type')
      .eq('user_id', userId)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString());

    const monthlyUsed = (monthlyTokenData || []).reduce(
      (sum: number, record: UserUsageToken) => sum + record.tokens_consumed,
      0,
    );

    // Calculate breakdown by feature type
    const breakdownMap = new Map<string, number>();
    (monthlyTokenData || []).forEach((record: UserUsageToken) => {
      const current = breakdownMap.get(record.feature_type) || 0;
      breakdownMap.set(record.feature_type, current + record.tokens_consumed);
    });

    const breakdown = Array.from(breakdownMap.entries()).map(
      ([featureType, tokensConsumed]) => ({
        featureType,
        tokensConsumed,
        percentage: monthlyUsed > 0 ? (tokensConsumed / monthlyUsed) * 100 : 0,
      }),
    );

    const limit = (limits?.token_limit as number) || 10000;
    const unlimited = limit === -1;
    const remaining = unlimited ? Infinity : Math.max(0, limit - monthlyUsed);
    const percentageUsed = unlimited
      ? 0
      : Math.min(100, (monthlyUsed / limit) * 100);

    return {
      totalUsed,
      monthlyUsed,
      limit: unlimited ? -1 : limit,
      remaining: unlimited ? -1 : remaining,
      percentageUsed: Math.round(percentageUsed * 100) / 100,
      breakdown,
    };
  }

  /**
   * Get API calls usage statistics
   */
  private async getApiCallsUsage(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    limits: Record<string, unknown> | null,
  ): Promise<UsageOverviewDto['apiCalls']> {
    const client = this.supabase.getServiceClient();

    // Get total API calls (all time)
    const { count: totalCalls } = await client
      .from('api_usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Get monthly API calls
    const { count: monthlyCallsCount, data: monthlyCallsData } = await client
      .from('api_usage_logs')
      .select('endpoint', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString());

    // Calculate breakdown by endpoint
    const endpointMap = new Map<string, number>();
    (monthlyCallsData || []).forEach((record: { endpoint: string }) => {
      const current = endpointMap.get(record.endpoint) || 0;
      endpointMap.set(record.endpoint, current + 1);
    });

    const byEndpoint = Array.from(endpointMap.entries())
      .map(([endpoint, count]) => ({
        endpoint,
        count,
        percentage: monthlyCallsCount
          ? monthlyCallsCount > 0
            ? (count / monthlyCallsCount) * 100
            : 0
          : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 endpoints

    const limit = (limits?.api_calls_limit as number) || 100;
    const unlimited = limit === -1;
    const remaining = unlimited
      ? Infinity
      : Math.max(0, limit - (monthlyCallsCount || 0));
    const percentageUsed = unlimited
      ? 0
      : Math.min(100, ((monthlyCallsCount || 0) / limit) * 100);

    return {
      totalCalls: totalCalls || 0,
      monthlyCallsCount: monthlyCallsCount || 0,
      limit: unlimited ? -1 : limit,
      remaining: unlimited ? -1 : remaining,
      percentageUsed: Math.round(percentageUsed * 100) / 100,
      byEndpoint,
    };
  }

  /**
   * Get recent user activities
   */
  private async getRecentActivities(
    userId: string,
    limit: number = 20,
  ): Promise<UsageOverviewDto['recentActivities']> {
    const client = this.supabase.getServiceClient();

    const { data: activities, error } = await client
      .from('user_activities')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error('Error fetching recent activities:', error);
      return [];
    }

    return (activities || []).map((activity: UserActivities) => ({
      id: activity.id,
      activityType: activity.activity_type,
      description: activity.description,
      timestamp: new Date(activity.created_at),
      metadata: activity.metadata,
    }));
  }

  /**
   * Get video analysis history
   */
  private async getVideoAnalysisHistory(
    userId: string,
    limit: number = 50,
  ): Promise<UsageOverviewDto['videoAnalysisHistory']> {
    const client = this.supabase.getServiceClient();

    const { data: audits, error } = await client
      .from('audits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error('Error fetching video analysis history:', error);
      return [];
    }

    return (audits || []).map(
      (audit: {
        id: string;
        video_id: string;
        metadata?: {
          video_title?: string;
          video_url?: string;
          analysis_type?: string;
          tokens_used?: number;
        };
        status?: string;
        created_at: string;
        completed_at?: string;
        results?: unknown;
      }) => ({
        id: audit.id,
        videoId: audit.video_id,
        videoTitle: audit.metadata?.video_title || 'Unknown',
        videoUrl: audit.metadata?.video_url || '',
        analysisType: audit.metadata?.analysis_type || 'full',
        tokensUsed: audit.metadata?.tokens_used || 0,
        status: audit.status || 'completed',
        createdAt: new Date(audit.created_at),
        completedAt: audit.completed_at
          ? new Date(audit.completed_at)
          : undefined,
        results: audit.results,
      }),
    );
  }

  private getUserRoleFromString(role: string | null): UserRole {
    switch (role) {
      case UserRole.ADMIN:
        return UserRole.ADMIN;
      case UserRole.MODERATOR:
        return UserRole.MODERATOR;
      case UserRole.USER:
      default:
        return UserRole.USER;
    }
  }

  private getValidProvider(
    provider: string | null | undefined,
  ): SocialProvider | 'email' {
    if (!provider) return 'email';

    // Check if it's a valid SocialProvider enum value
    if (Object.values(SocialProvider).includes(provider as SocialProvider)) {
      return provider as SocialProvider;
    }

    // Default to 'email' for any invalid provider values
    return 'email';
  }

  /**
   * Log admin actions for audit trail
   */
  private async logAdminAction(
    adminId: string,
    action: string,
    targetUserId: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const client = this.supabase.getServiceClient();

    try {
      await client.from('admin_audit_log').insert({
        admin_id: adminId,
        action,
        target_user_id: targetUserId,
        metadata,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to log admin action:', error);
      // Don't throw error - logging failure shouldn't break the operation
    }
  }
}
