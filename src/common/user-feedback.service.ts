import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLoggingService } from '../common/audit-logging.service';
import { AuditEventType } from '../common/types/audit-event.type';
import { AuditEventCategory } from '../common/types/audit-event-category.type';
import { AuditSeverity } from '../common/types/audit-severity.type';

export interface UserFeedback {
  id?: string;
  user_id: string;
  type: string;
  title: string;
  description: string;
  priority?: string;
  tags?: string[];
  current_page?: string;
  user_agent?: string;
  ip_address?: string;
  status: 'new' | 'in_review' | 'planned' | 'completed' | 'rejected';
  created_at?: string;
  updated_at?: string;
}

export interface FeatureRequest {
  id?: string;
  user_id: string;
  feature_name: string;
  description: string;
  use_case: string;
  importance: number;
  willingness_to_pay?: number;
  categories?: string[];
  votes: number;
  status:
    | 'submitted'
    | 'under_review'
    | 'planned'
    | 'in_development'
    | 'completed'
    | 'rejected';
  created_at?: string;
  updated_at?: string;
}

export interface UsageEvent {
  id?: string;
  user_id: string;
  feature: string;
  metadata?: Record<string, any>;
  satisfaction?: number;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
}

export interface FeedbackAnalytics {
  totalFeedbacks: number;
  feedbacksByType: Record<string, number>;
  averageSatisfaction: number;
  topRequestedFeatures: Array<{
    feature: string;
    requests: number;
    avgImportance: number;
  }>;
  recentFeedbacks: UserFeedback[];
  featureUsageStats: Array<{
    feature: string;
    usage_count: number;
    avg_satisfaction: number;
  }>;
}

@Injectable()
export class UserFeedbackService {
  private readonly logger = new Logger(UserFeedbackService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly auditLoggingService: AuditLoggingService,
  ) {}

  /**
   * Submit user feedback
   */
  async submitFeedback(
    userId: string,
    feedback: Omit<
      UserFeedback,
      'id' | 'user_id' | 'status' | 'created_at' | 'updated_at'
    >,
    ipAddress?: string,
  ): Promise<UserFeedback> {
    const client = this.supabase.getServiceClient();

    const feedbackData: Partial<UserFeedback> = {
      user_id: userId,
      ...feedback,
      status: 'new',
      ip_address: ipAddress,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('user_feedbacks')
      .insert(feedbackData)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to submit feedback:', error);
      throw new Error(`Failed to submit feedback: ${error.message}`);
    }

    // Log the feedback submission
    await this.auditLoggingService.logEvent({
      userId,
      eventType: AuditEventType.FEEDBACK_SUBMITTED,
      eventCategory: AuditEventCategory.USER_ACTIVITY,
      severity: AuditSeverity.INFO,
      resourceType: 'feedback',
      resourceId: data.id,
      action: 'submit_feedback',
      ipAddress,
      metadata: {
        feedbackType: feedback.type,
        title: feedback.title,
        priority: feedback.priority,
        tags: feedback.tags,
      },
    });

    this.logger.log(`Feedback submitted by user ${userId}: ${feedback.title}`);
    return data;
  }

  /**
   * Submit feature request
   */
  async submitFeatureRequest(
    userId: string,
    request: Omit<
      FeatureRequest,
      'id' | 'user_id' | 'votes' | 'status' | 'created_at' | 'updated_at'
    >,
    ipAddress?: string,
  ): Promise<FeatureRequest> {
    const client = this.supabase.getServiceClient();

    const requestData: Partial<FeatureRequest> = {
      user_id: userId,
      ...request,
      votes: 1, // User automatically votes for their own request
      status: 'submitted',
      created_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('feature_requests')
      .insert(requestData)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to submit feature request:', error);
      throw new Error(`Failed to submit feature request: ${error.message}`);
    }

    // Log the feature request
    await this.auditLoggingService.logEvent({
      userId,
      eventType: AuditEventType.FEATURE_REQUESTED,
      eventCategory: AuditEventCategory.USER_ACTIVITY,
      severity: AuditSeverity.INFO,
      resourceType: 'feature_request',
      resourceId: data.id,
      action: 'submit_feature_request',
      ipAddress,
      metadata: {
        featureName: request.feature_name,
        importance: request.importance,
        willingnessToPay: request.willingness_to_pay,
        categories: request.categories,
      },
    });

    this.logger.log(
      `Feature request submitted by user ${userId}: ${request.feature_name}`,
    );
    return data;
  }

  /**
   * Track feature usage
   */
  async trackUsage(
    userId: string,
    usage: Omit<UsageEvent, 'id' | 'user_id' | 'created_at'>,
    sessionId?: string,
    ipAddress?: string,
  ): Promise<void> {
    const client = this.supabase.getServiceClient();

    const usageData: Partial<UsageEvent> = {
      user_id: userId,
      ...usage,
      session_id: sessionId,
      ip_address: ipAddress,
      created_at: new Date().toISOString(),
    };

    const { error } = await client.from('usage_events').insert(usageData);

    if (error) {
      this.logger.error('Failed to track usage:', error);
      // Don't throw error for usage tracking failures
      return;
    }

    // Only log high-satisfaction or low-satisfaction usage events
    if (
      usage.satisfaction &&
      (usage.satisfaction >= 4 || usage.satisfaction <= 2)
    ) {
      const severity =
        usage.satisfaction >= 4 ? AuditSeverity.INFO : AuditSeverity.WARNING;

      await this.auditLoggingService.logEvent({
        userId,
        eventType: AuditEventType.FEATURE_USED,
        eventCategory: AuditEventCategory.USER_ACTIVITY,
        severity,
        resourceType: 'feature_usage',
        action: 'track_usage',
        ipAddress,
        metadata: {
          feature: usage.feature,
          satisfaction: usage.satisfaction,
          metadata: usage.metadata,
        },
      });
    }
  }

  /**
   * Get feedback analytics for admin dashboard
   */
  async getFeedbackAnalytics(
    timeRange: 'week' | 'month' | 'quarter' = 'month',
  ): Promise<FeedbackAnalytics> {
    const client = this.supabase.getServiceClient();
    const now = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
    }

    // Get feedback statistics
    const { data: feedbacks, error: feedbackError } = await client
      .from('user_feedbacks')
      .select('*')
      .gte('created_at', startDate.toISOString());

    if (feedbackError) {
      this.logger.error('Failed to get feedback analytics:', feedbackError);
      throw new Error(
        `Failed to get feedback analytics: ${feedbackError.message}`,
      );
    }

    // Get feature requests with vote counts
    const { data: featureRequests, error: featureError } = await client
      .from('feature_requests')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('votes', { ascending: false })
      .limit(10);

    if (featureError) {
      this.logger.error('Failed to get feature requests:', featureError);
      throw new Error(
        `Failed to get feature requests: ${featureError.message}`,
      );
    }

    // Get usage statistics
    const { data: usageEvents, error: usageError } = await client
      .from('usage_events')
      .select('*')
      .gte('created_at', startDate.toISOString());

    if (usageError) {
      this.logger.error('Failed to get usage events:', usageError);
      throw new Error(`Failed to get usage events: ${usageError.message}`);
    }

    // Calculate analytics
    const feedbacksByType = feedbacks.reduce(
      (acc: Record<string, number>, feedback: UserFeedback) => {
        acc[feedback.type] = (acc[feedback.type] || 0) + 1;
        return acc;
      },
      {},
    );

    const satisfactionEvents = usageEvents.filter(
      (event: UsageEvent) =>
        event.satisfaction !== null && event.satisfaction !== undefined,
    );
    const averageSatisfaction =
      satisfactionEvents.length > 0
        ? satisfactionEvents.reduce(
            (sum: number, event: UsageEvent) => sum + (event.satisfaction || 0),
            0,
          ) / satisfactionEvents.length
        : 0;

    const topRequestedFeatures = featureRequests
      .slice(0, 5)
      .map((request: FeatureRequest) => ({
        feature: request.feature_name,
        requests: request.votes,
        avgImportance: request.importance,
      }));

    const featureUsageMap = usageEvents.reduce(
      (
        acc: Record<
          string,
          {
            count: number;
            totalSatisfaction: number;
            satisfactionCount: number;
          }
        >,
        event: UsageEvent,
      ) => {
        if (!acc[event.feature]) {
          acc[event.feature] = {
            count: 0,
            totalSatisfaction: 0,
            satisfactionCount: 0,
          };
        }
        acc[event.feature].count++;
        if (event.satisfaction !== null && event.satisfaction !== undefined) {
          acc[event.feature].totalSatisfaction += event.satisfaction;
          acc[event.feature].satisfactionCount++;
        }
        return acc;
      },
      {},
    );

    const featureUsageStats = Object.entries(featureUsageMap)
      .map(([feature, stats]) => {
        const typedStats = stats as {
          count: number;
          totalSatisfaction: number;
          satisfactionCount: number;
        };
        return {
          feature,
          usage_count: typedStats.count,
          avg_satisfaction:
            typedStats.satisfactionCount > 0
              ? typedStats.totalSatisfaction / typedStats.satisfactionCount
              : 0,
        };
      })
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, 10);

    return {
      totalFeedbacks: feedbacks.length,
      feedbacksByType,
      averageSatisfaction: Math.round(averageSatisfaction * 100) / 100,
      topRequestedFeatures,
      recentFeedbacks: feedbacks
        .slice(0, 5)
        .sort(
          (a: UserFeedback, b: UserFeedback) =>
            new Date(b.created_at || '').getTime() -
            new Date(a.created_at || '').getTime(),
        ),
      featureUsageStats,
    };
  }

  /**
   * Get user's feedback history
   */
  async getUserFeedbacks(userId: string): Promise<UserFeedback[]> {
    const client = this.supabase.getServiceClient();

    const { data, error } = await client
      .from('user_feedbacks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Failed to get user feedbacks:', error);
      throw new Error(`Failed to get user feedbacks: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get user's feature requests
   */
  async getUserFeatureRequests(userId: string): Promise<FeatureRequest[]> {
    const client = this.supabase.getServiceClient();

    const { data, error } = await client
      .from('feature_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Failed to get user feature requests:', error);
      throw new Error(`Failed to get user feature requests: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Vote for a feature request
   */
  async voteForFeature(
    userId: string,
    featureRequestId: string,
  ): Promise<void> {
    const client = this.supabase.getServiceClient();

    // Check if user already voted
    const { data: existingVote } = await client
      .from('feature_votes')
      .select('id')
      .eq('user_id', userId)
      .eq('feature_request_id', featureRequestId)
      .single();

    if (existingVote) {
      throw new Error('User has already voted for this feature');
    }

    // Add vote
    const { error: voteError } = await client.from('feature_votes').insert({
      user_id: userId,
      feature_request_id: featureRequestId,
      created_at: new Date().toISOString(),
    });

    if (voteError) {
      this.logger.error('Failed to add vote:', voteError);
      throw new Error(`Failed to vote for feature: ${voteError.message}`);
    }

    // Increment vote count
    const { error: updateError } = await client.rpc('increment_feature_votes', {
      feature_id: featureRequestId,
    });

    if (updateError) {
      this.logger.error('Failed to increment vote count:', updateError);
    }

    this.logger.log(
      `User ${userId} voted for feature request ${featureRequestId}`,
    );
  }
}
