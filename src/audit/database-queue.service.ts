import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { YoutubeService } from '../youtube/youtube.service';
import { AiService } from '../ai/ai.service';
import { AuditRepository } from './audit.repository';
import { SupabaseStorageService } from '../supabase/supabase-storage.service';
import { AiMessageConfiguration } from '../auth/types/ai-configuration.model';
import * as fs from 'node:fs/promises';
import * as path from 'path';
import * as os from 'os';
import { VideoAnalysisJob } from './models/video-analysis-job.model';
import { DBJobResultModel } from './models/db-job-result.model';
import { AuditResponse } from './models/audit.types';
import { FilgeDataModel } from './models/file-data.model';
import { VideoAnalysisLogService } from '../logging/services/video-analysis-log.servce';
import {
  VideoAnalysisStatus,
  LogSeverity,
  SystemLogCategory,
} from '../logging/dto/log.types';
import { SystemLogService } from '../logging/services/system-log.service';

@Injectable()
export class DatabaseQueueService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseQueueService.name);
  private isProcessing = false;
  private readonly MAX_CONCURRENT_JOBS = 3;
  private readonly MAX_JOBS_PER_USER = 5;
  private activeJobs = new Set<string>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly youtubeService: YoutubeService,
    private readonly aiService: AiService,
    private readonly auditRepo: AuditRepository,
    private readonly storage: SupabaseStorageService,
    private readonly videoAnalysisLogService: VideoAnalysisLogService,
    private readonly systemLogService: SystemLogService,
  ) {}

  onModuleInit() {
    setTimeout(() => {
      this.processJobs().catch((error) => {
        this.logger.error('Error in initial processJobs:', error);
        throw error;
      });
    }, 1000);
  }

  async addVideoAnalysisJob(jobData: VideoAnalysisJob): Promise<string> {
    const client = this.supabase.getClient();

    // Get video data for YouTube jobs
    let videoTitle = 'Video Analysis Job';
    if (jobData.type === 'youtube' && jobData.configuration?.url) {
      try {
        const videoData = await this.youtubeService.getVideoData(
          jobData.configuration.url,
        );
        videoTitle = videoData.title ?? 'YouTube Video Analysis';
      } catch (error) {
        this.logger.warn(
          'Could not fetch video:',
          error instanceof Error
            ? error.message
            : 'Invalid YouTube URL or unable to fetch video data',
        );
        throw new Error(
          'Could not fetch video: Invalid YouTube URL or unable to fetch video data',
        );
      }
    }

    // Check current user job counts
    const { data: userJobs, error: countError } = await client
      .from('job_queue')
      .select('id, status', { count: 'exact' })
      .eq('user_id', jobData.userId)
      .in('status', ['pending', 'processing']);

    if (countError) {
      this.logger.error('Failed to check user job count:', countError);
      throw new Error('Failed to check job queue status');
    }

    const activeJobCount = userJobs?.length || 0;
    const processingCount =
      userJobs?.filter((job) => job.status === 'processing').length || 0;
    const pendingCount =
      userJobs?.filter((job) => job.status === 'pending').length || 0;

    // Allow unlimited pending jobs, but warn user about queue position
    this.logger.log(
      `User ${jobData.userId} jobs: ${processingCount} processing, ${pendingCount} pending, ${activeJobCount} total active`,
    );

    // Optional: Set a maximum total queue size (including pending) to prevent abuse
    const MAX_TOTAL_QUEUE_SIZE = 20; // Adjust as needed
    if (activeJobCount >= MAX_TOTAL_QUEUE_SIZE) {
      throw new Error(
        `Maximum queue size exceeded (${activeJobCount}/${MAX_TOTAL_QUEUE_SIZE}). Please wait for some jobs to complete before adding more.`,
      );
    }

    // Convert Buffer to base64 for JSON storage
    const payload = { ...jobData };
    payload.video_title = videoTitle;

    if (payload.fileData?.buffer) {
      payload.fileData = {
        ...payload.fileData,
        buffer: payload.fileData.buffer,
      };
    }

    const { data, error } = await client
      .from('job_queue')
      .insert({
        user_id: jobData.userId,
        job_type: jobData.type,
        payload: payload,
        status: 'pending',
      })
      .select()
      .single<DBJobResultModel>();

    if (error) {
      this.logger.error('Failed to queue job:', error);
      throw new Error(`Failed to queue job: ${error.message}`);
    }

    const queuePosition = pendingCount + 1;
    const estimatedWaitTime =
      Math.ceil(queuePosition / this.MAX_CONCURRENT_JOBS) * 2;

    this.logger.log(
      `Job ${data.id} queued for user ${jobData.userId}. Queue position: ${queuePosition}, estimated wait: ${estimatedWaitTime} minutes`,
    );

    // Trigger immediate processing check
    setTimeout(() => {
      this.processJobs().catch((error) => {
        this.logger.error('Error in delayed processJobs:', error);
      });
    }, 100);

    return data.id.toString();
  }

  async getJobStatus(jobId: string) {
    const client = this.supabase.getClient();

    const { data: job, error } = await client
      .from('job_queue')
      .select('*')
      .eq('id', jobId)
      .single<DBJobResultModel>();

    if (error || !job) {
      return { status: 'not_found' };
    }

    return {
      status: job.status,
      progress: job.progress || 0,
      data: job.payload,
      result: job.result,
      error: job.error_message,
      createdAt: new Date(job.created_at),
      processedAt: job.started_at ? new Date(job.started_at) : null,
      finishedAt: job.completed_at ? new Date(job.completed_at) : null,
    };
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const client = this.supabase.getClient();

    // First, check if the job is currently being processed
    const jobIdStr = jobId.toString();
    const isActivelyProcessing = this.activeJobs.has(jobIdStr);

    if (isActivelyProcessing) {
      // Mark the job as cancelled in the activeJobs set so processJob can handle it
      this.logger.log(
        `Job ${jobId} is currently processing, marking for cancellation`,
      );
    }

    const { data, error } = await client
      .from('job_queue')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error_message: 'Job cancelled by user',
      })
      .eq('id', jobId)
      .in('status', ['pending', 'processing']) // This should work for both pending and processing jobs
      .select();

    this.logger.log('Cancel job result:', {
      jobId,
      data,
      error,
      affectedRows: data?.length,
    });

    if (error) {
      this.logger.error('Failed to cancel job:', error);
      return false;
    }

    // Check if any rows were affected
    const cancelled = data && data.length > 0;

    if (cancelled) {
      this.logger.log(`Job ${jobId} successfully cancelled`);
      // Remove from activeJobs if it was being processed
      this.activeJobs.delete(jobIdStr);
    } else {
      this.logger.warn(
        `Job ${jobId} could not be cancelled - it may have already completed or doesn't exist`,
      );
    }

    return cancelled;
  }

  async getUserJobs(userId: string) {
    const client = this.supabase.getClient();

    const { data: jobs, error } = await client
      .from('job_queue')
      .select(
        'id, job_type, status, progress, created_at, completed_at, payload',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<DBJobResultModel[]>();

    if (error) {
      this.logger.error('Failed to get user jobs:', error);
      return [];
    }

    return jobs.map((job) => ({
      id: job.id,
      status: job.status,
      type: job.job_type,
      createdAt: new Date(job.created_at),
      progress: job.progress || 0,
      completedAt: job.completed_at ? new Date(job.completed_at) : null,
      data: job.payload,
    }));
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  @Cron(CronExpression.EVERY_5_SECONDS)
  async processJobs() {
    if (this.isProcessing || this.activeJobs.size >= this.MAX_CONCURRENT_JOBS) {
      return;
    }

    this.isProcessing = true;

    try {
      const client = this.supabase.getClient();

      // Get all pending jobs ordered by creation time (FIFO)
      const { data: pendingJobs, error } = await client
        .from('job_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(50)
        .returns<DBJobResultModel[]>(); // Get more jobs to filter through

      if (error) {
        this.logger.error('Failed to fetch pending jobs:', error);
        await this.systemLogService.logSystem({
          logLevel: LogSeverity.ERROR,
          category: SystemLogCategory.QUEUE,
          serviceName: 'DatabaseQueueService',
          message: 'Failed to fetch pending jobs from queue',
          details: {
            error: error.message,
            activeJobs: this.activeJobs.size,
          },
          stackTrace: error instanceof Error ? error.stack : undefined,
        });
        return;
      }

      // Log queue metrics
      const queueDepth = pendingJobs?.length || 0;
      if (queueDepth > 20) {
        await this.systemLogService.logSystem({
          logLevel: LogSeverity.WARNING,
          category: SystemLogCategory.QUEUE,
          serviceName: 'DatabaseQueueService',
          message: 'High queue depth detected',
          details: {
            queueDepth,
            activeJobs: this.activeJobs.size,
            maxConcurrent: this.MAX_CONCURRENT_JOBS,
          },
        });
      }

      if (!pendingJobs || pendingJobs.length === 0) {
        return;
      }

      // Group jobs by user to check individual limits
      const jobsByUser = new Map<string, DBJobResultModel[]>();
      pendingJobs.forEach((job) => {
        if (!job.user_id) return;
        const userId = job.user_id;
        if (!jobsByUser.has(userId)) {
          jobsByUser.set(userId, []);
        }
        jobsByUser.get(userId)!.push(job);
      });

      // Get current processing jobs count per user
      const { data: processingJobs } = await client
        .from('job_queue')
        .select('user_id')
        .eq('status', 'processing')
        .returns<DBJobResultModel[]>();

      const processingByUser = new Map<string, number>();
      processingJobs?.forEach((job) => {
        if (!job.user_id) return;
        const userId = job.user_id;
        processingByUser.set(userId, (processingByUser.get(userId) || 0) + 1);
      });

      // Select jobs to process, respecting per-user limits
      const jobsToProcess: DBJobResultModel[] = [];
      const availableSlots = this.MAX_CONCURRENT_JOBS - this.activeJobs.size;

      for (const [userId, userJobs] of jobsByUser.entries()) {
        if (jobsToProcess.length >= availableSlots) break;

        const userProcessingCount = processingByUser.get(userId) || 0;

        // Allow up to MAX_JOBS_PER_USER concurrent jobs per user
        if (userProcessingCount < this.MAX_JOBS_PER_USER) {
          const slotsForUser = Math.min(
            this.MAX_JOBS_PER_USER - userProcessingCount,
            availableSlots - jobsToProcess.length,
          );

          // Take the oldest jobs for this user
          const userJobsToAdd = userJobs.slice(0, slotsForUser);
          jobsToProcess.push(...userJobsToAdd);

          this.logger.log(
            `User ${userId}: ${userProcessingCount} processing, adding ${userJobsToAdd.length} more jobs`,
          );
        } else {
          this.logger.log(
            `User ${userId}: reached concurrent limit (${userProcessingCount}/${this.MAX_JOBS_PER_USER}), skipping`,
          );
        }
      }

      if (jobsToProcess.length === 0) {
        this.logger.log(
          'No jobs available to process (all users at their limits)',
        );
        return;
      }

      this.logger.log(
        `Processing ${jobsToProcess.length} jobs from ${jobsByUser.size} users`,
      );

      // Process selected jobs concurrently
      for (const job of jobsToProcess) {
        void this.processJobAsync(job);
      }
    } catch (error) {
      this.logger.error('Error in processJobs:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async retryJob(jobId: string): Promise<string> {
    const client = this.supabase.getClient();

    // Get the original job
    const { data: originalJob, error: fetchError } = await client
      .from('job_queue')
      .select('*')
      .eq('id', jobId)
      .single<DBJobResultModel>();

    if (fetchError || !originalJob) {
      throw new Error('Job not found');
    }

    // Check if job can be retried
    if (originalJob.status !== 'failed' && originalJob.status !== 'cancelled') {
      throw new Error('Only failed or cancelled jobs can be retried');
    }

    this.logger.log(`Retrying job ${jobId} for user ${originalJob.user_id}`);

    // Check rate limit for user (same as addVideoAnalysisJob)
    const { count: userJobCount } = await client
      .from('job_queue')
      .select('id', { count: 'exact' })
      .eq('user_id', originalJob.user_id)
      .in('status', ['pending', 'processing']);

    if (userJobCount ?? 0 >= this.MAX_JOBS_PER_USER) {
      throw new Error(
        `Too many jobs in queue. Maximum ${this.MAX_JOBS_PER_USER} concurrent jobs allowed.`,
      );
    }
    // Create new job with same payload but reset status
    const { data: newJob, error: insertError } = await client
      .from('job_queue')
      .insert({
        user_id: originalJob.user_id,
        job_type: originalJob.job_type,
        payload: originalJob.payload,
        status: 'pending',
        progress: 0,
      })
      .select()
      .single<DBJobResultModel>();

    if (insertError) {
      this.logger.error('Failed to create retry job:', insertError);
      throw new Error(`Failed to create retry job: ${insertError.message}`);
    }

    // Optionally mark original job as retried
    await client
      .from('job_queue')
      .update({
        error_message: `${originalJob.error_message || 'Job failed'} (Retried as job ${newJob.id})`,
      })
      .eq('id', jobId);

    this.logger.log(`Retry job ${newJob.id} created for original job ${jobId}`);

    // Trigger immediate processing check
    setTimeout(() => {
      this.processJobs().catch((error) => {
        this.logger.error('Error in delayed processJobs:', error);
      });
    }, 100);

    return newJob.id.toString();
  }

  private async processJobAsync(job: DBJobResultModel) {
    const jobId = job.id.toString();
    this.activeJobs.add(jobId);

    try {
      await this.processJob(job);
    } catch (error) {
      this.logger.error(`Failed to process job ${jobId}:`, error);
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  private async processJob(job: DBJobResultModel) {
    const client = this.supabase.getClient();
    const jobId = job.id.toString();

    try {
      // Mark as processing
      await client
        .from('job_queue')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
          progress: 10,
        })
        .eq('id', jobId);

      this.logger.log(`Processing job ${jobId} of type ${job.job_type}`);

      // Update video analysis log to PROCESSING
      try {
        await this.videoAnalysisLogService.updateLogByVideoId(jobId, {
          status: VideoAnalysisStatus.PROCESSING,
          stage: 'processing',
          progressPercentage: 10,
        });
      } catch (logError) {
        this.logger.warn(`Failed to update video analysis log: ${logError}`);
      }

      const payload = job.payload;

      // Convert base64 buffer back to Buffer
      if (
        payload.fileData?.buffer &&
        typeof payload.fileData.buffer === 'string'
      ) {
        payload.fileData.buffer = Buffer.from(
          payload.fileData.buffer,
          'base64',
        );
      }

      // Check usage limit
      if (!payload.userId) {
        throw new Error('Invalid job payload: missing userId');
      }
      const usedCount = await this.auditRepo.countUserAudits(payload.userId);
      const maxFree = 100;
      if (usedCount >= maxFree) {
        throw new Error('Free plan limit reached. Please upgrade.');
      }

      await this.updateJobProgress(jobId.toString(), 20);

      let result: AuditResponse;

      // Process based on job type
      switch (job.job_type) {
        case 'youtube': {
          if (payload.configuration === null) {
            throw new Error('Invalid job payload: missing configuration');
          }
          result = await this.processYouTubeVideo(
            jobId.toString(),
            payload.configuration,
          );
          break;
        }
        case 'upload': {
          if (!payload.fileData || !payload.accessToken) {
            throw new Error(
              'Invalid job payload: missing file data or access token',
            );
          }
          result = await this.processUploadedVideo(
            jobId.toString(),
            payload.fileData,
            payload.accessToken,
          );
          break;
        }
        case 'transcript': {
          if (!payload.transcript) {
            throw new Error('Invalid job payload: missing transcript');
          }
          if (!payload.userId) {
            throw new Error('Invalid job payload: missing userId');
          }
          result = await this.processTranscript(
            jobId.toString(),
            payload.transcript,
          );
          break;
        }
        default:
          throw new Error(`Unknown job type: ${job.job_type}`);
      }

      await this.updateJobProgress(jobId.toString(), 90);

      // Save the audit
      const url =
        job.job_type === 'youtube'
          ? payload.configuration?.url
          : job.job_type === 'upload'
            ? 'uploaded-file'
            : '';

      const savedAudit = await this.auditRepo.saveAudit(
        payload.userId,
        url ?? '',
        result,
      );

      // Log usage event
      await client.from('usage_events').insert({
        user_id: payload.userId,
        event_type: 'audit_created',
      });

      // Mark as completed
      await client
        .from('job_queue')
        .update({
          status: 'completed',
          progress: 100,
          result: savedAudit,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      this.logger.log(`Job ${jobId} completed successfully`);

      // Update video analysis log to COMPLETED
      try {
        await this.videoAnalysisLogService.updateLogByVideoId(jobId, {
          status: VideoAnalysisStatus.COMPLETED,
          stage: 'completed',
          progressPercentage: 100,
          auditId: savedAudit.data.id,
          results: result as unknown as Record<string, unknown>,
        });
      } catch (logError) {
        this.logger.warn(`Failed to update video analysis log: ${logError}`);
      }
    } catch (error) {
      this.logger.error(`Job ${jobId} failed:`, error);

      // Mark as failed
      await client
        .from('job_queue')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : String(error),
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      // Update video analysis log to FAILED
      try {
        await this.videoAnalysisLogService.updateLogByVideoId(jobId, {
          status: VideoAnalysisStatus.FAILED,
          stage: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error),
          errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
        });
      } catch (logError) {
        this.logger.warn(`Failed to update video analysis log: ${logError}`);
      }
    }
  }

  private async updateJobProgress(jobId: string, progress: number) {
    const client = this.supabase.getClient();
    await client.from('job_queue').update({ progress }).eq('id', jobId);
  }

  private async processYouTubeVideo(
    jobId: string,
    configuration: AiMessageConfiguration,
  ): Promise<AuditResponse> {
    await this.updateJobProgress(jobId, 20);

    // Get video metadata and transcript
    const video = await this.youtubeService.getVideoData(configuration.url);
    const transcript = await this.youtubeService.getVideoTranscript(
      configuration.url,
    );

    await this.updateJobProgress(jobId, 40);

    // Generate comprehensive analysis using new methods
    const language = configuration.language || 'en';
    const tone = configuration.tone || 'professional';

    const [titleRewrite, descriptionRewrite, keywordExtraction, chapters] =
      await Promise.all([
        this.aiService.generateTitleRewrite(
          transcript,
          language,
          tone,
          video.title,
        ),
        this.aiService.generateDescriptionRewrite(transcript),
        this.aiService.extractKeywords(transcript),
        this.aiService.generateChapters(transcript),
      ]);

    await this.updateJobProgress(jobId, 80);

    // Optionally generate thumbnail ideas (can be skipped for faster processing)
    let thumbnailIdeas: any[] = [];
    let thumbnailAIPrompts: string[] = [];
    
    try {
      [thumbnailIdeas, thumbnailAIPrompts] = await Promise.all([
        this.aiService.generateThumbnailIdeas(transcript),
        this.aiService.generateThumbnailAIPrompts(transcript),
      ]);
    } catch (error) {
      this.logger.warn(
        'Thumbnail generation failed, continuing without it',
        error,
      );
    }

    const videoData: AuditResponse = {
      video,
      analysis: {
        titleRewrite,
        descriptionRewrite,
        keywordExtraction,
        chapters,
        thumbnailIdeas,
        thumbnailAIPrompts,
      },
    };

    return videoData;
  }

  private async processUploadedVideo(
    jobId: string,
    fileData: FilgeDataModel,
    accessToken: string,
  ): Promise<AuditResponse> {
    const { buffer, originalName, mimetype } = fileData;

    await this.updateJobProgress(jobId, 30);

    // Get user ID from job
    const client = this.supabase.getClient();
    const { data: job } = await client
      .from('job_queue')
      .select('user_id')
      .eq('id', jobId)
      .single<{ user_id: string }>();

    if (!job || !job.user_id) {
      throw new Error('Job user ID not found');
    }
    const userId = job.user_id;

    // Upload to storage
    const file = {
      buffer,
      originalname: originalName,
      mimetype,
    } as Express.Multer.File;
    const { publicUrl, key } = await this.storage.uploadVideo(
      userId,
      file,
      accessToken,
    );

    await this.updateJobProgress(jobId, 50);

    // Create temporary file for transcription
    const tmpPath = path.join(os.tmpdir(), `${Date.now()}-${originalName}`);
    await fs.writeFile(tmpPath, buffer);

    try {
      const transcript = await this.aiService.transcribeLocalFile(tmpPath);

      await this.updateJobProgress(jobId, 50);

      const summary = await this.aiService.summarizeTranscript(transcript);

      await this.updateJobProgress(jobId, 60);

      // Generate comprehensive analysis using new methods
      const [titleRewrite, descriptionRewrite, keywordExtraction, chapters] =
        await Promise.all([
          this.aiService.generateTitleRewrite(
            transcript,
            'en',
            'professional',
            'Uploaded Video',
          ),
          this.aiService.generateDescriptionRewrite(transcript),
          this.aiService.extractKeywords(transcript),
          this.aiService.generateChapters(transcript),
        ]);

      return {
        video: {
          id: key,
          title: titleRewrite.titles?.[0] ?? 'Draft Video',
          description: summary,
          tags: keywordExtraction.primaryKeywords,
          thumbnail: publicUrl,
          publishedAt: '',
          duration: chapters.totalDuration || '',
          views: 0,
          likes: 0,
          comments: 0,
        },
        analysis: {
          titleRewrite,
          descriptionRewrite,
          keywordExtraction,
          chapters,
        },
      };
    } finally {
      // Clean up temp file
      await fs.unlink(tmpPath);
    }
  }

  private async processTranscript(
    jobId: string,
    transcript: string,
  ): Promise<AuditResponse> {
    await this.updateJobProgress(jobId, 40);

    const summary = await this.aiService.summarizeTranscript(transcript);

    await this.updateJobProgress(jobId, 70);

    // Generate comprehensive analysis using new methods
    const [titleRewrite, descriptionRewrite, keywordExtraction, chapters] =
      await Promise.all([
        this.aiService.generateTitleRewrite(
          transcript,
          'en',
          'professional',
          'Untitled Video',
        ),
        this.aiService.generateDescriptionRewrite(transcript),
        this.aiService.extractKeywords(transcript),
        this.aiService.generateChapters(transcript),
      ]);

    return {
      video: {
        id: 'transcript-' + Date.now(),
        title: titleRewrite.titles?.[0] ?? 'Draft Video',
        description: summary,
        tags: keywordExtraction.primaryKeywords,
        thumbnail: '',
        publishedAt: '',
        duration: chapters.totalDuration || '',
        views: 0,
        likes: 0,
        comments: 0,
      },
      analysis: {
        titleRewrite,
        descriptionRewrite,
        keywordExtraction,
        chapters,
      },
    };
  }

  // Cleanup old jobs (run daily)
  // Change the cleanup to run more frequently and clean up completed jobs sooner
  @Cron(CronExpression.EVERY_HOUR) // Run every hour instead of daily
  async cleanupOldJobs() {
    const startTime = Date.now();
    const client = this.supabase.getClient();

    try {
      // Clean up completed jobs older than 1 hour (instead of 7 days)
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      // Clean up failed/cancelled jobs older than 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      // Count jobs before cleanup
      const { count: completedCount } = await client
        .from('job_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .lt('completed_at', oneHourAgo.toISOString());

      const { count: failedCount } = await client
        .from('job_queue')
        .select('*', { count: 'exact', head: true })
        .in('status', ['failed', 'cancelled'])
        .lt('completed_at', oneDayAgo.toISOString());

      // Delete completed jobs older than 1 hour
      const { error: completedError } = await client
        .from('job_queue')
        .delete()
        .eq('status', 'completed')
        .lt('completed_at', oneHourAgo.toISOString());

      if (completedError) {
        this.logger.error('Failed to cleanup completed jobs:', completedError);
        await this.systemLogService.logSystem({
          logLevel: LogSeverity.ERROR,
          category: SystemLogCategory.CRON,
          serviceName: 'DatabaseQueueService',
          message: 'Cron job failed - cleanupOldJobs (completed)',
          details: {
            error: completedError.message,
            executionTimeMs: Date.now() - startTime,
          },
          stackTrace:
            completedError instanceof Error ? completedError.stack : undefined,
        });
      } else {
        this.logger.log('Completed jobs cleaned up successfully');
      }

      // Delete failed/cancelled jobs older than 24 hours
      const { error: failedError } = await client
        .from('job_queue')
        .delete()
        .in('status', ['failed', 'cancelled'])
        .lt('completed_at', oneDayAgo.toISOString());

      if (failedError) {
        this.logger.error('Failed to cleanup failed jobs:', failedError);
        await this.systemLogService.logSystem({
          logLevel: LogSeverity.ERROR,
          category: SystemLogCategory.CRON,
          serviceName: 'DatabaseQueueService',
          message: 'Cron job failed - cleanupOldJobs (failed)',
          details: {
            error: failedError.message,
            executionTimeMs: Date.now() - startTime,
          },
          stackTrace:
            failedError instanceof Error ? failedError.stack : undefined,
        });
      } else {
        this.logger.log('Failed/cancelled jobs cleaned up successfully');
      }

      // Log successful cleanup
      const executionTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.CRON,
        serviceName: 'DatabaseQueueService',
        message: 'Cron job completed - cleanupOldJobs',
        details: {
          completedJobsRemoved: completedCount || 0,
          failedJobsRemoved: failedCount || 0,
          totalRemoved: (completedCount || 0) + (failedCount || 0),
          executionTimeMs: executionTime,
        },
      });
    } catch (error) {
      this.logger.error('Error in cleanupOldJobs:', error);
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.CRON,
        serviceName: 'DatabaseQueueService',
        message: 'Cron job exception - cleanupOldJobs',
        details: {
          error: error instanceof Error ? error.message : String(error),
          executionTimeMs: Date.now() - startTime,
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
    }
  }
}
