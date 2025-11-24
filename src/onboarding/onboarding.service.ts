import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  OnboardingStep,
  UserType,
  ContentCategory,
  StartOnboardingDto,
  UpdateUserTypeDto,
  CompleteFirstAnalysisDto,
  UpdatePreferencesDto,
  OnboardingProgressResponse,
} from './dto/onboarding.dto';
import { UserLogService } from 'src/logging/services/user-log.service';
import { LogSeverity, LogType } from 'src/logging/dto/log.types';
import { LogAggregatorService } from 'src/logging/services/log-aggregator.service';

interface OnboardingData {
  id?: string;
  user_id: string;
  current_step: OnboardingStep;
  completed_steps: OnboardingStep[];
  user_type?: UserType;
  content_categories?: ContentCategory[];
  monthly_video_count?: number;
  channel_name?: string;
  first_analysis_completed?: boolean;
  first_analysis_rating?: number;
  preferences?: {
    preferred_tone?: string;
    target_audience?: string;
    email_notifications?: boolean;
    browser_notifications?: boolean;
  };
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly userLogService: UserLogService,
    private readonly logAggregatorService: LogAggregatorService,
  ) {}

  async startOnboarding(
    userId: string,
    data: StartOnboardingDto,
    ipAddress?: string,
  ): Promise<OnboardingProgressResponse> {
    try {
      const client = this.supabaseService.getServiceClient();
      const { data: existing } = (await client
        .from('user_onboarding')
        .select('*')
        .eq('user_id', userId)
        .single()) as { data: OnboardingData | null; error: any };

      if (existing) {
        const { error } = await client
          .from('user_onboarding')
          .update({
            channel_name: data.channelName,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (error) throw error;

        return this.getOnboardingProgress(userId);
      } else {
        const onboardingData: Partial<OnboardingData> = {
          user_id: userId,
          current_step: OnboardingStep.USER_TYPE,
          completed_steps: [OnboardingStep.WELCOME],
          channel_name: data.channelName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error } = await client
          .from('user_onboarding')
          .insert([onboardingData]);

        if (error) throw error;

        await this.userLogService.logActivity({
          userId,
          logType: LogType.ACTIVITY,
          activityType: 'onboarding_started',
          description: `User started onboarding process for channel: ${data.channelName}`,
          severity: LogSeverity.INFO,
          ipAddress,
          metadata: {
            channelName: data.channelName,
          },
        });
        return this.getOnboardingProgress(userId);
      }
    } catch (error) {
      this.logger.error('Failed to start onboarding:', error);
      await this.userLogService.logActivity({
        userId,
        logType: LogType.ACTIVITY,
        activityType: 'onboarding_started',
        description: `User started onboarding process for channel: ${data.channelName}`,
        severity: LogSeverity.INFO,
        ipAddress,
        metadata: {
          channelName: data.channelName,
        },
      });

      throw error;
    }
  }

  async updateUserType(
    userId: string,
    data: UpdateUserTypeDto,
    ipAddress?: string,
  ): Promise<OnboardingProgressResponse> {
    try {
      const client = this.supabaseService.getServiceClient();

      // Get current onboarding data before update
      const { data: currentData } = await client
        .from('user_onboarding')
        .select('user_type, content_categories, monthly_video_count')
        .eq('user_id', userId)
        .single();

      const updateData: Partial<OnboardingData> = {
        user_type: data.userType,
        content_categories: data.contentCategories,
        monthly_video_count: data.monthlyVideoCount,
        current_step: OnboardingStep.FIRST_ANALYSIS,
        completed_steps: [OnboardingStep.WELCOME, OnboardingStep.USER_TYPE],
        updated_at: new Date().toISOString(),
      };

      const { error } = await client
        .from('user_onboarding')
        .update(updateData)
        .eq('user_id', userId);

      if (error) throw error;

      await this.userLogService.logActivity({
        userId,
        logType: LogType.ACTIVITY,
        activityType: 'onboarding_step_completed',
        description: `User completed onboarding step: ${updateData.current_step}`,
        severity: LogSeverity.INFO,
        ipAddress,
        metadata: {
          step: updateData.user_type,
          currentStep: updateData.current_step,
          totalSteps: updateData.completed_steps,
        },
      });

      // Audit trail for user type update
      await this.logAggregatorService.logAuditTrail({
        actorId: userId,
        actorEmail: 'self',
        actorRole: 'user',
        action: 'update_user_type',
        entityType: 'user_onboarding',
        entityId: userId,
        oldValues: {
          userType: currentData?.user_type || null,
          contentCategories: currentData?.content_categories || [],
          monthlyVideoCount: currentData?.monthly_video_count || null,
        },
        newValues: {
          userType: data.userType,
          contentCategories: data.contentCategories,
          monthlyVideoCount: data.monthlyVideoCount,
        },
        changes: ['user_type', 'content_categories', 'monthly_video_count'],
        ipAddress,
        userAgent: 'unknown',
        metadata: {
          onboardingStep: OnboardingStep.USER_TYPE,
          completedSteps: [OnboardingStep.WELCOME, OnboardingStep.USER_TYPE],
        },
      });

      return this.getOnboardingProgress(userId);
    } catch (error) {
      this.logger.error('Failed to update user type:', error);
      await this.userLogService.logActivity({
        userId,
        logType: LogType.ERROR,
        activityType: 'onboarding_step_update_failed',
        description: `Failed to update onboarding step: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: LogSeverity.ERROR,
        ipAddress,
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async completeFirstAnalysis(
    userId: string,
    data: CompleteFirstAnalysisDto,
    ipAddress: string,
  ): Promise<OnboardingProgressResponse> {
    try {
      const client = this.supabaseService.getServiceClient();

      const updateData: Partial<OnboardingData> = {
        first_analysis_completed: true,
        first_analysis_rating: data.analysisRating,
        current_step: OnboardingStep.FEATURES_TOUR,
        completed_steps: [
          OnboardingStep.WELCOME,
          OnboardingStep.USER_TYPE,
          OnboardingStep.FIRST_ANALYSIS,
        ],
        updated_at: new Date().toISOString(),
      };

      const { error } = await client
        .from('user_onboarding')
        .update(updateData)
        .eq('user_id', userId);

      if (error) throw error;

      await this.userLogService.logActivity({
        userId,
        logType: LogType.ACTIVITY,
        activityType: 'onboarding_step_completed',
        description: `User completed onboarding step: ${updateData.current_step}`,
        severity: LogSeverity.INFO,
        ipAddress,
        metadata: {
          step: updateData.first_analysis_completed,
        },
      });

      return this.getOnboardingProgress(userId);
    } catch (error) {
      this.logger.error('Failed to complete first analysis:', error);
      throw error;
    }
  }

  async updatePreferences(
    userId: string,
    data: UpdatePreferencesDto,
    ipAddress: string,
  ): Promise<OnboardingProgressResponse> {
    try {
      const client = this.supabaseService.getServiceClient();

      // Get current preferences before update
      const { data: currentData } = await client
        .from('user_onboarding')
        .select('preferences')
        .eq('user_id', userId)
        .single();

      const updateData: Partial<OnboardingData> = {
        preferences: {
          preferred_tone: data.preferredTone,
          target_audience: data.targetAudience,
          email_notifications: data.emailNotifications,
          browser_notifications: data.browserNotifications,
        },
        current_step: OnboardingStep.COMPLETED,
        completed_steps: [
          OnboardingStep.WELCOME,
          OnboardingStep.USER_TYPE,
          OnboardingStep.FIRST_ANALYSIS,
          OnboardingStep.FEATURES_TOUR,
          OnboardingStep.PREFERENCES,
        ],
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await client
        .from('user_onboarding')
        .update(updateData)
        .eq('user_id', userId);

      if (error) throw error;

      await this.userLogService.logActivity({
        userId,
        logType: LogType.ACTIVITY,
        activityType: 'onboarding_completed',
        description: `User completed onboarding`,
        severity: LogSeverity.INFO,
        ipAddress,
        metadata: {
          preferences: data,
          completedAt: new Date().toISOString(),
        },
      });

      // Audit trail for preferences update
      await this.logAggregatorService.logAuditTrail({
        actorId: userId,
        actorEmail: 'self',
        actorRole: 'user',
        action: 'update_preferences',
        entityType: 'user_onboarding',
        entityId: userId,
        oldValues: {
          preferences: currentData?.preferences || {},
        },
        newValues: {
          preferences: updateData.preferences,
        },
        changes: ['preferences', 'onboarding_completed'],
        ipAddress,
        userAgent: 'unknown',
        metadata: {
          onboardingStep: OnboardingStep.PREFERENCES,
          onboardingCompleted: true,
          completedAt: updateData.completed_at,
        },
      });

      return this.getOnboardingProgress(userId);
    } catch (error) {
      await this.userLogService.logActivity({
        userId,
        logType: LogType.ERROR,
        activityType: 'onboarding_completion_failed',
        description: `Failed to complete onboarding: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: LogSeverity.ERROR,
        ipAddress,
        metadata: {
          preferences: data,
          completedAt: new Date().toISOString(),
        },
      });
      throw error;
    }
  }

  async skipStep(
    userId: string,
    step: OnboardingStep,
    ipAddress: string,
  ): Promise<OnboardingProgressResponse> {
    try {
      const progress = await this.getOnboardingProgress(userId);
      const nextStep = this.getNextStep(step);

      if (nextStep) {
        const client = this.supabaseService.getServiceClient();

        const { error } = await client
          .from('user_onboarding')
          .update({
            current_step: nextStep,
            completed_steps: [...progress.completedSteps, step],
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (error) throw error;

        await this.userLogService.logActivity({
          userId,
          logType: LogType.ACTIVITY,
          activityType: 'onboarding_step_skipped',
          description: `User skipped onboarding step ${step}`,
          severity: LogSeverity.INFO,
          ipAddress,
          metadata: {
            skippedStep: step,
            nextStep,
          },
        });
      }
      return this.getOnboardingProgress(userId);
    } catch (error) {
      await this.userLogService.logActivity({
        userId,
        logType: LogType.ERROR,
        activityType: 'onboarding_step_skip_failed',
        description: `Failed to skip onboarding step ${step}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: LogSeverity.ERROR,
        ipAddress,
        metadata: {
          skippedStep: step,
        },
      });
      throw error;
    }
  }

  async getOnboardingProgress(
    userId: string,
  ): Promise<OnboardingProgressResponse> {
    try {
      const client = this.supabaseService.getServiceClient();

      const { data } = (await client
        .from('user_onboarding')
        .select('*')
        .eq('user_id', userId)
        .single()) as { data: OnboardingData | null; error: any };

      if (!data) {
        return {
          currentStep: OnboardingStep.WELCOME,
          progressPercentage: 0,
          completedSteps: [],
          nextAction: "Welcome! Let's set up your YouTube Optimizer account.",
          estimatedTimeRemaining: '5 minutes',
        };
      }

      const progressPercentage = this.calculateProgress(
        data.completed_steps || [],
      );
      const nextAction = this.getNextActionMessage(data.current_step);
      const estimatedTime = this.getEstimatedTime(data.current_step);

      return {
        currentStep: data.current_step,
        progressPercentage,
        completedSteps: data.completed_steps || [],
        nextAction,
        estimatedTimeRemaining: estimatedTime,
      };
    } catch (error) {
      this.logger.error('Failed to get onboarding progress:', error);
      throw new NotFoundException('Onboarding progress not found');
    }
  }

  private calculateProgress(completedSteps: OnboardingStep[]): number {
    const totalSteps = Object.values(OnboardingStep).length;
    return Math.round((completedSteps.length / totalSteps) * 100);
  }

  private getNextStep(currentStep: OnboardingStep): OnboardingStep | null {
    const stepOrder = [
      OnboardingStep.WELCOME,
      OnboardingStep.USER_TYPE,
      OnboardingStep.FIRST_ANALYSIS,
      OnboardingStep.FEATURES_TOUR,
      OnboardingStep.PREFERENCES,
      OnboardingStep.COMPLETED,
    ];

    const currentIndex = stepOrder.indexOf(currentStep);
    return currentIndex < stepOrder.length - 1
      ? stepOrder[currentIndex + 1]
      : null;
  }

  private getNextActionMessage(currentStep: OnboardingStep): string {
    const actions = {
      [OnboardingStep.WELCOME]:
        "Let's get started by telling us about yourself!",
      [OnboardingStep.USER_TYPE]: 'Tell us about your content type and goals.',
      [OnboardingStep.FIRST_ANALYSIS]:
        'Try analyzing your first YouTube video to see AI suggestions!',
      [OnboardingStep.FEATURES_TOUR]:
        'Explore key features to maximize your video performance.',
      [OnboardingStep.PREFERENCES]:
        'Customize your experience with personal preferences.',
      [OnboardingStep.COMPLETED]:
        "You're all set! Start optimizing your YouTube content.",
    };

    return actions[currentStep] || 'Continue your onboarding journey.';
  }

  private getEstimatedTime(currentStep: OnboardingStep): string {
    const timeEstimates = {
      [OnboardingStep.WELCOME]: '5 minutes',
      [OnboardingStep.USER_TYPE]: '4 minutes',
      [OnboardingStep.FIRST_ANALYSIS]: '3 minutes',
      [OnboardingStep.FEATURES_TOUR]: '2 minutes',
      [OnboardingStep.PREFERENCES]: '1 minute',
      [OnboardingStep.COMPLETED]: 'Complete!',
    };

    return timeEstimates[currentStep] || 'A few minutes';
  }
}
