// src/logging/services/video-analysis-log.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from 'src/supabase/supabase.service';
import { VideoAnalysisLogData, VideoAnalysisStatus } from '../dto/log.types';

@Injectable()
export class VideoAnalysisLogService {
  private readonly logger = new Logger(VideoAnalysisLogService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Create video analysis log
   * NOTE: Video analysis is a CORE BUSINESS FEATURE - always logged to Supabase
   * Also logged to Winston for detailed debugging
   */
  async createLog(data: VideoAnalysisLogData): Promise<string> {
    const client = this.supabase.getServiceClient();

    try {
      const { data: logData, error } = await client
        .from('video_analysis_logs')
        .insert({
          user_id: data.userId,
          audit_id: data.auditId || null,
          video_id: data.videoId,
          video_url: data.videoUrl,
          video_title: data.videoTitle || null,
          analysis_type: data.analysisType,
          status: data.status,
          stage: data.stage || null,
          progress_percentage: data.progressPercentage || 0,
          tokens_consumed: data.tokensConsumed || 0,
          prompt_tokens: data.promptTokens || 0,
          completion_tokens: data.completionTokens || 0,
          model_used: data.modelUsed || null,
          cost_usd: data.costUsd || null,
          processing_time_ms: data.processingTimeMs || null,
          error_message: data.errorMessage || null,
          error_code: data.errorCode || null,
          retry_count: data.retryCount || 0,
          metadata: data.metadata || {},
          results: data.results || null,
          initiated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single<{ id: string }>();

      if (error) {
        throw error;
      }

      this.logger.log(
        `Created video analysis log: ${logData.id} for video ${data.videoId}`,
      );
      return logData.id;
    } catch (error) {
      this.logger.error('Error creating video analysis log:', error);
      throw error;
    }
  }

  /**
   * Update video analysis log
   */
  async updateLog(
    logId: string,
    updates: Partial<VideoAnalysisLogData>,
  ): Promise<void> {
    const client = this.supabase.getServiceClient();

    try {
      const updateData: Record<string, unknown> = {};

      if (updates.status !== undefined) {
        updateData.status = updates.status;

        // Set timestamps based on status
        if (updates.status === VideoAnalysisStatus.PROCESSING) {
          updateData.started_at = new Date().toISOString();
        } else if (updates.status === VideoAnalysisStatus.COMPLETED) {
          updateData.completed_at = new Date().toISOString();
        } else if (updates.status === VideoAnalysisStatus.FAILED) {
          updateData.failed_at = new Date().toISOString();
        }
      }

      if (updates.stage !== undefined) updateData.stage = updates.stage;
      if (updates.progressPercentage !== undefined)
        updateData.progress_percentage = updates.progressPercentage;
      if (updates.tokensConsumed !== undefined)
        updateData.tokens_consumed = updates.tokensConsumed;
      if (updates.promptTokens !== undefined)
        updateData.prompt_tokens = updates.promptTokens;
      if (updates.completionTokens !== undefined)
        updateData.completion_tokens = updates.completionTokens;
      if (updates.modelUsed !== undefined)
        updateData.model_used = updates.modelUsed;
      if (updates.costUsd !== undefined) updateData.cost_usd = updates.costUsd;
      if (updates.processingTimeMs !== undefined)
        updateData.processing_time_ms = updates.processingTimeMs;
      if (updates.errorMessage !== undefined)
        updateData.error_message = updates.errorMessage;
      if (updates.errorCode !== undefined)
        updateData.error_code = updates.errorCode;
      if (updates.retryCount !== undefined)
        updateData.retry_count = updates.retryCount;
      if (updates.metadata !== undefined)
        updateData.metadata = updates.metadata;
      if (updates.results !== undefined) updateData.results = updates.results;

      const { error } = await client
        .from('video_analysis_logs')
        .update(updateData)
        .eq('id', logId);

      if (error) {
        throw error;
      }

      this.logger.debug(`Updated video analysis log: ${logId}`);
    } catch (error) {
      this.logger.error('Error updating video analysis log:', error);
      throw error;
    }
  }

  /**
   * Update video analysis log by video ID
   */
  async updateLogByVideoId(
    videoId: string,
    updates: Partial<VideoAnalysisLogData>,
  ): Promise<void> {
    const client = this.supabase.getServiceClient();

    try {
      const updateData: Record<string, unknown> = {};

      if (updates.status !== undefined) {
        updateData.status = updates.status;

        // Set timestamps based on status
        if (updates.status === VideoAnalysisStatus.PROCESSING) {
          updateData.started_at = new Date().toISOString();
        } else if (updates.status === VideoAnalysisStatus.COMPLETED) {
          updateData.completed_at = new Date().toISOString();
        } else if (updates.status === VideoAnalysisStatus.FAILED) {
          updateData.failed_at = new Date().toISOString();
        }
      }

      if (updates.stage !== undefined) updateData.stage = updates.stage;
      if (updates.progressPercentage !== undefined)
        updateData.progress_percentage = updates.progressPercentage;
      if (updates.auditId !== undefined) updateData.audit_id = updates.auditId;
      if (updates.tokensConsumed !== undefined)
        updateData.tokens_consumed = updates.tokensConsumed;
      if (updates.promptTokens !== undefined)
        updateData.prompt_tokens = updates.promptTokens;
      if (updates.completionTokens !== undefined)
        updateData.completion_tokens = updates.completionTokens;
      if (updates.modelUsed !== undefined)
        updateData.model_used = updates.modelUsed;
      if (updates.costUsd !== undefined) updateData.cost_usd = updates.costUsd;
      if (updates.processingTimeMs !== undefined)
        updateData.processing_time_ms = updates.processingTimeMs;
      if (updates.errorMessage !== undefined)
        updateData.error_message = updates.errorMessage;
      if (updates.errorCode !== undefined)
        updateData.error_code = updates.errorCode;
      if (updates.retryCount !== undefined)
        updateData.retry_count = updates.retryCount;
      if (updates.metadata !== undefined)
        updateData.metadata = updates.metadata;
      if (updates.results !== undefined) updateData.results = updates.results;

      const { error } = await client
        .from('video_analysis_logs')
        .update(updateData)
        .eq('video_id', videoId);

      if (error) {
        throw error;
      }

      this.logger.debug(`Updated video analysis log for video: ${videoId}`);
    } catch (error) {
      this.logger.error(
        'Error updating video analysis log by video ID:',
        error,
      );
      throw error;
    }
  }

  /**
   * Get video analysis logs
   */
  async getLogs(filters?: {
    userId?: string;
    videoId?: string;
    status?: VideoAnalysisStatus;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const client = this.supabase.getServiceClient();

    try {
      let query = client
        .from('video_analysis_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters?.videoId) {
        query = query.eq('video_id', filters.videoId);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(
          filters.offset,
          filters.offset + (filters.limit || 10) - 1,
        );
      }

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      return {
        data: data || [],
        total: count || 0,
      };
    } catch (error) {
      this.logger.error('Error fetching video analysis logs:', error);
      throw error;
    }
  }

  /**
   * Get video analysis statistics
   */
  async getStatistics(userId?: string, days: number = 30) {
    const client = this.supabase.getServiceClient();

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let query = client
        .from('video_analysis_logs')
        .select('status, tokens_consumed, cost_usd, processing_time_ms')
        .gte('created_at', startDate.toISOString());

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const stats = {
        totalAnalyses: data?.length || 0,
        completedCount: 0,
        failedCount: 0,
        processingCount: 0,
        totalTokens: 0,
        totalCost: 0,
        avgProcessingTime: 0,
      };

      let totalProcessingTime = 0;
      let processedCount = 0;

      (data || []).forEach((log) => {
        if (log.status === VideoAnalysisStatus.COMPLETED) {
          stats.completedCount++;
        } else if (log.status === VideoAnalysisStatus.FAILED) {
          stats.failedCount++;
        } else if (log.status === VideoAnalysisStatus.PROCESSING) {
          stats.processingCount++;
        }

        stats.totalTokens += log.tokens_consumed || 0;
        stats.totalCost += parseFloat(String(log.cost_usd || '0'));

        if (log.processing_time_ms) {
          totalProcessingTime += log.processing_time_ms;
          processedCount++;
        }
      });

      if (processedCount > 0) {
        stats.avgProcessingTime = totalProcessingTime / processedCount;
      }

      return stats;
    } catch (error) {
      this.logger.error('Error fetching video analysis statistics:', error);
      throw error;
    }
  }
}
