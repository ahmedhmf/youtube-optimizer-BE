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
} from '../DTO/onboarding.dto';
// Audit logging will be integrated later
// import { AuditLoggingService } from './audit-logging.service';
// import { AuditEventType } from './types/audit-event.type';
// import { AuditEventCategory } from './types/audit-event-category.type';
// import { AuditSeverity } from './types/audit-severity.type';
// import { AuditStatus } from './types/audit-status.type';

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
    // private readonly auditLoggingService: AuditLoggingService,
  ) {}

  async startOnboarding(
    userId: string,
    data: StartOnboardingDto,
    _ipAddress?: string,
  ): Promise<OnboardingProgressResponse> {
    try {
      const client = this.supabaseService.getServiceClient();

      // Check if user already has onboarding record
      const { data: existing } = (await client
        .from('user_onboarding')
        .select('*')
        .eq('user_id', userId)
        .single()) as { data: OnboardingData | null; error: any };

      if (existing) {
        // Update existing record
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
        // Create new onboarding record
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

        // Log onboarding start
        // await this.auditLoggingService.logEvent({
        //   userId,
        //   eventType: AuditEventType.USER_ACTION,
        //   eventCategory: AuditEventCategory.USER_ACTIVITY,
        //   severity: AuditSeverity.INFO,
        //   status: AuditStatus.SUCCESS,
        //   ipAddress,
        //   action: 'onboarding_started',
        //   metadata: {
        //     channelName: data.channelName,
        //     step: OnboardingStep.WELCOME,
        //   },
        // });
        this.logger.log(`Onboarding started for user ${userId}`);

        return this.getOnboardingProgress(userId);
      }
    } catch (error) {
      this.logger.error('Failed to start onboarding:', error);
      throw error;
    }
  }

  async updateUserType(
    userId: string,
    data: UpdateUserTypeDto,
    _ipAddress?: string,
  ): Promise<OnboardingProgressResponse> {
    try {
      const client = this.supabaseService.getServiceClient();

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

      // Log user type selection
      // await this.auditLoggingService.logEvent({
      //   userId,
      //   eventType: AuditEventType.USER_ACTION,
      //   eventCategory: AuditEventCategory.USER_ACTIVITY,
      //   severity: AuditSeverity.INFO,
      //   status: AuditStatus.SUCCESS,
      //   ipAddress,
      //   action: 'user_type_selected',
      //   metadata: {
      //     userType: data.userType,
      //     contentCategories: data.contentCategories,
      //     monthlyVideoCount: data.monthlyVideoCount,
      //   },
      // });
      this.logger.log(
        `User type selected for user ${userId}: ${data.userType}`,
      );

      return this.getOnboardingProgress(userId);
    } catch (error) {
      this.logger.error('Failed to update user type:', error);
      throw error;
    }
  }

  async completeFirstAnalysis(
    userId: string,
    data: CompleteFirstAnalysisDto,
    _ipAddress: string,
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

      // Log first analysis completion
      // await this.auditLoggingService.logEvent({
      //   userId,
      //   eventType: AuditEventType.USER_ACTION,
      //   eventCategory: AuditEventCategory.USER_ACTIVITY,
      //   severity: AuditSeverity.INFO,
      //   status: AuditStatus.SUCCESS,
      //   ipAddress,
      //   action: 'first_analysis_completed',
      //   metadata: {
      //     videoReference: data.videoReference,
      //     rating: data.analysisRating,
      //     feedback: data.feedback,
      //   },
      // });
      this.logger.log(`First analysis completed for user ${userId}`);

      return this.getOnboardingProgress(userId);
    } catch (error) {
      this.logger.error('Failed to complete first analysis:', error);
      throw error;
    }
  }

  async updatePreferences(
    userId: string,
    data: UpdatePreferencesDto,
    _ipAddress: string,
  ): Promise<OnboardingProgressResponse> {
    try {
      const client = this.supabaseService.getServiceClient();

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

      // Log onboarding completion
      // await this.auditLoggingService.logEvent({
      //   userId,
      //   eventType: AuditEventType.USER_ACTION,
      //   eventCategory: AuditEventCategory.USER_ACTIVITY,
      //   severity: AuditSeverity.INFO,
      //   status: AuditStatus.SUCCESS,
      //   ipAddress,
      //   action: 'onboarding_completed',
      //   metadata: {
      //     preferences: data,
      //     completedAt: new Date().toISOString(),
      //   },
      // });
      this.logger.log(`Onboarding completed for user ${userId}`);

      return this.getOnboardingProgress(userId);
    } catch (error) {
      this.logger.error('Failed to update preferences:', error);
      throw error;
    }
  }

  async skipStep(
    userId: string,
    step: OnboardingStep,
    _ipAddress: string,
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

        // Log step skip
        // await this.auditLoggingService.logEvent({
        //   userId,
        //   eventType: AuditEventType.USER_ACTION,
        //   eventCategory: AuditEventCategory.USER_ACTIVITY,
        //   severity: AuditSeverity.INFO,
        //   status: AuditStatus.SUCCESS,
        //   ipAddress,
        //   action: 'onboarding_step_skipped',
        //   metadata: {
        //     skippedStep: step,
        //     nextStep,
        //   },
        // });
        this.logger.log(`Step ${step} skipped for user ${userId}`);
      }

      return this.getOnboardingProgress(userId);
    } catch (error) {
      this.logger.error('Failed to skip step:', error);
      throw error;
    }
  }

  async getOnboardingProgress(
    userId: string,
  ): Promise<OnboardingProgressResponse> {
    try {
      const client = this.supabaseService.getServiceClient();

      const { data, error } = (await client
        .from('user_onboarding')
        .select('*')
        .eq('user_id', userId)
        .single()) as { data: OnboardingData | null; error: any };

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) {
        // Return initial state if no onboarding record exists
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
