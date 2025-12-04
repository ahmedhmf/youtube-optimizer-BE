import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiSecurity,
  ApiHeader,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuditRepository } from './audit.repository';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { UserRole } from '../auth/types/roles.types';
import { AiMessageConfiguration } from 'src/auth/types/ai-configuration.model';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseStorageService } from 'src/supabase/supabase-storage.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PaginationQueryDto } from 'src/DTO/pagination-query.dto';
import { DatabaseQueueService } from './database-queue.service';
import { PaginatedResponse } from 'src/auth/types/paginated-responce.model';
import type { AuthenticatedRequest } from './models/authenticated-request.model';
import { UserLogService } from '../logging/services/user-log.service';
import { LogAggregatorService } from '../logging/services/log-aggregator.service';
import { LogSeverity, LogType } from '../logging/dto/log.types';
import { VideoAnalysisLogService } from '../logging/services/video-analysis-log.servce';
import { VideoAnalysisStatus } from '../logging/dto/log.types';

const ALLOWED = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
];

@ApiTags('Video Analysis & AI Optimization')
@Controller('analyze')
@ApiBearerAuth('access-token')
export class AuditController {
  private readonly logger = new Logger(AuditController.name);

  constructor(
    private readonly auditRepo: AuditRepository,
    private readonly supabase: SupabaseService,
    private readonly storage: SupabaseStorageService,
    private readonly queueService: DatabaseQueueService,
    private readonly userLogService: UserLogService,
    private readonly logAggregatorService: LogAggregatorService,
    private readonly videoAnalysisLogService: VideoAnalysisLogService,
  ) {}

  @ApiOperation({
    summary: 'Analyze YouTube Video',
    description:
      'Submit a YouTube video for AI-powered optimization analysis. Returns a job ID to track analysis progress.',
  })
  @ApiBody({
    description: 'AI configuration for video analysis',
    schema: {
      type: 'object',
      properties: {
        configuration: {
          type: 'object',
          properties: {
            videoUrl: {
              type: 'string',
              example: 'https://youtube.com/watch?v=example',
            },
            analysisType: { type: 'string', example: 'full-optimization' },
            targetAudience: { type: 'string', example: 'general' },
            focusAreas: {
              type: 'array',
              items: { type: 'string' },
              example: ['title', 'thumbnail', 'description'],
            },
          },
          required: ['videoUrl'],
        },
      },
      required: ['configuration'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Video analysis job created successfully',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', example: 'queue_123456789' },
        message: {
          type: 'string',
          example:
            'Video analysis queued successfully. Check job status for progress.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid configuration or video URL',
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded (3 requests per 5 minutes)',
  })
  @ApiHeader({
    name: 'Authorization',
    description: 'Bearer token for authentication',
    required: true,
    schema: {
      type: 'string',
      example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
  })
  @Post('video')
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.PREMIUM, UserRole.MODERATOR, UserRole.ADMIN)
  async analyzeVideo(
    @Body() body: { configuration: AiMessageConfiguration },
    @Req() req: AuthenticatedRequest,
  ): Promise<{ jobId: string; message: string }> {
    const userId = req.user.id;
    const email = req.user.email;
    const jobId = `video-${userId}-${Date.now()}`;
    try {
      const queueJobId = await this.queueService.addVideoAnalysisJob({
        userId,
        email,
        jobId,
        type: 'youtube',
        configuration: body.configuration,
      });

      // Log video analysis request
      await this.userLogService.logActivity({
        userId,
        logType: LogType.ACTIVITY,
        activityType: 'video_analysis_requested',
        description: `User requested YouTube video analysis`,
        severity: LogSeverity.INFO,
        ipAddress: req.ip,
        userAgent: String(req.headers['user-agent'] || 'unknown'),
        metadata: {
          jobId: queueJobId,
          videoUrl: body.configuration.url,
          analysisType: 'standard',
        },
      });

      // Create video analysis log
      await this.videoAnalysisLogService.createLog({
        userId,
        videoId: queueJobId,
        videoUrl: body.configuration.url || 'unknown',
        videoTitle: 'YouTube Video',
        analysisType: 'standard',
        status: VideoAnalysisStatus.INITIATED,
        stage: 'queued',
        progressPercentage: 0,
        metadata: {
          jobId: queueJobId,
          queuedAt: new Date().toISOString(),
          configuration: body.configuration,
        },
      });

      return {
        jobId: queueJobId,
        message:
          'Video analysis queued successfully. Check job status for progress.',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to queue analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  @ApiOperation({
    summary: 'Analyze Uploaded Video File',
    description:
      'Upload and analyze a video file (MP4, WebM, MOV, MP3, WAV). Maximum file size: 200MB. Returns job ID for tracking.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Video file upload for analysis',
    schema: {
      type: 'object',
      properties: {
        video: {
          type: 'string',
          format: 'binary',
          description:
            'Video file to analyze (MP4, WebM, MOV, MP3, WAV - Max 200MB)',
        },
      },
      required: ['video'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Video upload queued successfully',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', example: 'queue_987654321' },
        message: {
          type: 'string',
          example:
            'Video upload queued successfully. Check job status for progress.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or missing file',
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 413, description: 'File too large (max 200MB)' })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded (5 uploads per 5 minutes)',
  })
  @Post('upload')
  @Throttle({ default: { limit: 5, ttl: 300000 } }) // 5 uploads per 5 minutes
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('video', {
      storage: memoryStorage(),
      limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
    }),
  )
  async analyzeUploadedVideo(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ jobId: string; message: string }> {
    // Change return type
    if (!file) {
      throw new BadRequestException(
        'No video file uploaded (field name: video).',
      );
    }
    if (!ALLOWED.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    const userId = req.user.id;
    const email = req.user.email;
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    const jobId = `upload-${userId}-${Date.now()}`;

    try {
      const queueJobId = await this.queueService.addVideoAnalysisJob({
        userId,
        email,
        jobId,
        type: 'upload',
        fileData: {
          buffer: file.buffer,
          originalName: file.originalname,
          mimetype: file.mimetype,
        },
        accessToken,
      });

      // Log video upload analysis request
      await this.userLogService.logActivity({
        userId,
        logType: LogType.ACTIVITY,
        activityType: 'video_upload_analysis_requested',
        description: `User uploaded video for analysis: ${file.originalname}`,
        severity: LogSeverity.INFO,
        ipAddress: req.ip,
        userAgent: String(req.headers['user-agent'] || 'unknown'),
        metadata: {
          jobId: queueJobId,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
        },
      });

      // Create video analysis log for upload
      await this.videoAnalysisLogService.createLog({
        userId,
        videoId: queueJobId,
        videoUrl: `upload://${file.originalname}`,
        videoTitle: file.originalname,
        analysisType: 'upload',
        status: VideoAnalysisStatus.INITIATED,
        stage: 'upload_queued',
        progressPercentage: 0,
        metadata: {
          jobId: queueJobId,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          queuedAt: new Date().toISOString(),
        },
      });

      return {
        jobId: queueJobId,
        message:
          'Video upload queued successfully. Check job status for progress.',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to queue analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  @ApiOperation({
    summary: 'Analyze Video Transcript',
    description:
      'Submit a video transcript for AI analysis and optimization suggestions. Useful for content already transcribed.',
  })
  @ApiBody({
    description: 'Transcript and AI configuration for analysis',
    schema: {
      type: 'object',
      properties: {
        configuration: {
          type: 'object',
          properties: {
            analysisType: { type: 'string', example: 'content-optimization' },
            targetAudience: { type: 'string', example: 'tech-professionals' },
            focusAreas: {
              type: 'array',
              items: { type: 'string' },
              example: ['engagement', 'clarity', 'seo'],
            },
          },
        },
        transcript: {
          type: 'string',
          example:
            "Welcome to today's tutorial on web development. In this video, we'll explore...",
        },
      },
      required: ['configuration', 'transcript'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Transcript analysis queued successfully',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', example: 'queue_transcript_456' },
        message: {
          type: 'string',
          example:
            'Transcript analysis queued successfully. Check job status for progress.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid transcript or configuration',
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded (3 analyses per 5 minutes)',
  })
  @Post('transcript')
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 transcript analyses per 5 minutes
  @UseGuards(JwtAuthGuard)
  async analyzeTranscript(
    @Body() body: { configuration: AiMessageConfiguration; transcript: string },
    @Req() req: AuthenticatedRequest,
  ): Promise<{ jobId: string; message: string }> {
    // Change return type
    const userId = req.user.id;
    const email = req.user.email;
    const jobId = `transcript-${userId}-${Date.now()}`;

    try {
      const queueJobId = await this.queueService.addVideoAnalysisJob({
        userId,
        email,
        jobId,
        type: 'transcript',
        transcript: body.transcript,
        configuration: body.configuration,
      });

      // Log transcript analysis request
      await this.userLogService.logActivity({
        userId,
        logType: LogType.ACTIVITY,
        activityType: 'transcript_analysis_requested',
        description: 'User submitted transcript for analysis',
        severity: LogSeverity.INFO,
        ipAddress: req.ip,
        userAgent: String(req.headers['user-agent'] || 'unknown'),
        metadata: {
          jobId: queueJobId,
          transcriptLength: body.transcript.length,
          analysisType: 'standard',
        },
      });

      // Create video analysis log for transcript
      await this.videoAnalysisLogService.createLog({
        userId,
        videoId: queueJobId,
        videoUrl: 'transcript://direct',
        videoTitle: 'Transcript Analysis',
        analysisType: 'transcript',
        status: VideoAnalysisStatus.INITIATED,
        stage: 'transcript_queued',
        progressPercentage: 0,
        metadata: {
          jobId: queueJobId,
          transcriptLength: body.transcript.length,
          queuedAt: new Date().toISOString(),
          configuration: body.configuration,
        },
      });

      return {
        jobId: queueJobId,
        message:
          'Transcript analysis queued successfully. Check job status for progress.',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to queue analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // NEW ENDPOINTS for job management
  @ApiOperation({
    summary: 'Get Analysis Job Status',
    description:
      'Check the current status and progress of a video analysis job. Users can only access their own jobs.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Unique identifier for the analysis job',
    example: 'queue_123456789',
  })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'queue_123456789' },
        status: {
          type: 'string',
          enum: ['waiting', 'active', 'completed', 'failed', 'cancelled'],
          example: 'completed',
        },
        progress: { type: 'number', example: 100 },
        data: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            type: { type: 'string', enum: ['youtube', 'upload', 'transcript'] },
            jobId: { type: 'string' },
          },
        },
        result: {
          type: 'object',
          properties: {
            analysis: { type: 'object' },
            recommendations: { type: 'array', items: { type: 'string' } },
            completedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid job ID or unauthorized access',
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @Get('job/:jobId/status')
  @UseGuards(JwtAuthGuard)
  async getJobStatus(
    @Param('jobId') jobId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const status = await this.queueService.getJobStatus(jobId);

      // Ensure user can only see their own jobs
      if (status.data && status.data.userId !== req.user.id) {
        throw new BadRequestException('Unauthorized access to job');
      }
      return status;
    } catch (error) {
      throw new BadRequestException(
        `Failed to get job status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  @ApiOperation({
    summary: 'Cancel Analysis Job',
    description:
      'Cancel a pending or active analysis job. Only the job owner can cancel their jobs.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Unique identifier for the job to cancel',
    example: 'queue_123456789',
  })
  @ApiResponse({
    status: 200,
    description: 'Job cancellation result',
    schema: {
      type: 'object',
      properties: {
        cancelled: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Job cancelled successfully' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Job not found, already completed, or unauthorized',
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @Post('job/:jobId/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelJob(
    @Param('jobId') jobId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const job = await this.queueService.getJobStatus(jobId);

      if (job.data && job.data.userId !== req.user.id) {
        throw new BadRequestException('Unauthorized access to job');
      }

      const cancelled = await this.queueService.cancelJob(jobId);

      if (cancelled) {
        // Log job cancellation
        await this.userLogService.logActivity({
          userId: req.user.id,
          logType: LogType.ACTIVITY,
          activityType: 'job_cancelled',
          description: 'User cancelled an analysis job',
          severity: LogSeverity.INFO,
          ipAddress: req.ip,
          userAgent: String(req.headers['user-agent'] || 'unknown'),
          metadata: {
            jobId,
            jobType: job.data?.type,
          },
        });
      }

      return {
        cancelled,
        message: cancelled
          ? 'Job cancelled successfully'
          : 'Job not found or already completed',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to cancel job: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  @ApiOperation({
    summary: 'Get User Analysis Jobs',
    description:
      'Retrieve all analysis jobs for the authenticated user, including status and progress information.',
  })
  @ApiResponse({
    status: 200,
    description: 'User jobs retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'queue_123456789' },
          status: {
            type: 'string',
            enum: ['waiting', 'active', 'completed', 'failed', 'cancelled'],
          },
          progress: { type: 'number', minimum: 0, maximum: 100 },
          createdAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
          type: { type: 'string', enum: ['youtube', 'upload', 'transcript'] },
          data: { type: 'object' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @Get('jobs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getUserJobs(@Req() req: AuthenticatedRequest) {
    try {
      return await this.queueService.getUserJobs(req.user.id);
    } catch (error) {
      throw new BadRequestException(
        `Failed to get user jobs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  @ApiOperation({
    summary: 'Retry Failed Analysis Job',
    description:
      'Retry a failed or cancelled analysis job with a new job ID. Only failed or cancelled jobs can be retried.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Unique identifier for the failed job to retry',
    example: 'queue_failed_123',
  })
  @ApiResponse({
    status: 200,
    description: 'Job retry initiated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        newJobId: { type: 'string', example: 'queue_retry_456' },
        message: {
          type: 'string',
          example: 'Job has been queued for retry with a new job ID',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Job cannot be retried or unauthorized access',
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @Post('job/:jobId/retry')
  @UseGuards(JwtAuthGuard)
  async retryJob(
    @Param('jobId') jobId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const job = await this.queueService.getJobStatus(jobId);

      // Check if user owns this job
      if (job.data && job.data.userId !== req.user.id) {
        throw new BadRequestException('Unauthorized access to job');
      }

      // Check if job can be retried
      if (job.status !== 'failed' && job.status !== 'cancelled') {
        throw new BadRequestException(
          'Only failed or cancelled jobs can be retried',
        );
      }

      const newJobId = await this.queueService.retryJob(jobId);

      // Log job retry
      await this.userLogService.logActivity({
        userId: req.user.id,
        logType: LogType.ACTIVITY,
        activityType: 'job_retried',
        description: 'User retried a failed analysis job',
        severity: LogSeverity.INFO,
        ipAddress: req.ip,
        userAgent: String(req.headers['user-agent'] || 'unknown'),
        metadata: {
          originalJobId: jobId,
          newJobId,
          previousStatus: job.status,
          jobType: job.data?.type,
        },
      });

      return {
        success: true,
        newJobId,
        message: 'Job has been queued for retry with a new job ID',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to retry job: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  @ApiOperation({
    summary: 'Restart Failed/Cancelled Analysis Job',
    description:
      'Restart a failed or cancelled analysis job by resetting it to pending status (uses same job ID). Only failed or cancelled jobs can be restarted.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'Unique identifier for the failed/cancelled job to restart',
    example: 'queue_failed_123',
  })
  @ApiResponse({
    status: 200,
    description: 'Job restarted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        jobId: { type: 'string', example: 'queue_failed_123' },
        message: {
          type: 'string',
          example: 'Job has been restarted successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Job cannot be restarted or unauthorized access',
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @Post('job/:jobId/restart')
  @UseGuards(JwtAuthGuard)
  async restartJob(
    @Param('jobId') jobId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      const job = await this.queueService.getJobStatus(jobId);

      // Check if user owns this job
      if (job.data && job.data.userId !== req.user.id) {
        throw new BadRequestException('Unauthorized access to job');
      }

      // Check if job can be restarted
      if (job.status !== 'failed' && job.status !== 'cancelled') {
        throw new BadRequestException(
          'Only failed or cancelled jobs can be restarted',
        );
      }

      const restarted = await this.queueService.restartJob(jobId);

      // Log job restart
      await this.userLogService.logActivity({
        userId: req.user.id,
        logType: LogType.ACTIVITY,
        activityType: 'job_restarted',
        description: 'User restarted a failed/cancelled analysis job',
        severity: LogSeverity.INFO,
        ipAddress: req.ip,
        userAgent: String(req.headers['user-agent'] || 'unknown'),
        metadata: {
          jobId,
          previousStatus: job.status,
          jobType: job.data?.type,
        },
      });

      return {
        success: restarted,
        jobId,
        message: 'Job has been restarted successfully',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to retry job: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Keep your existing endpoints as they are
  @ApiOperation({
    summary: 'Get User Analysis History',
    description:
      'Retrieve paginated history of completed video analyses for the authenticated user with search and sorting capabilities.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (1-50, default: 10)',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search in video titles, descriptions, or URLs',
    example: 'tutorial',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Sort field (default: created_at)',
    example: 'created_at',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort direction (default: desc)',
    example: 'desc',
  })
  @ApiResponse({
    status: 200,
    description: 'User history retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              user_id: { type: 'string' },
              url: { type: 'string', nullable: true },
              audit_data: { type: 'object' },
              thumbnail_url: { type: 'string', nullable: true },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 10 },
            total: { type: 'number', example: 42 },
            totalPages: { type: 'number', example: 5 },
            hasNext: { type: 'boolean', example: true },
            hasPrev: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid pagination parameters' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getUserHistory(
    @Query() query: PaginationQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<PaginatedResponse<any>> {
    const userId = req.user.id;

    // Validate and set defaults
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const offset = (page - 1) * limit;
    const search = query.search?.trim();
    const sortBy = query.sortBy || 'created_at';
    const sortOrder =
      query.sortOrder === 'asc' ? { ascending: true } : { ascending: false };

    const client = this.supabase.getClient();
    let baseQuery = client
      .from('audits')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (search) {
      baseQuery = baseQuery.or(
        `audit_data->>video->title.ilike.%${search}%,audit_data->>video->description.ilike.%${search}%,url.ilike.%${search}%`,
      );
    }

    const { count: totalCount, error: countError } = await baseQuery;

    if (countError) {
      throw new Error(`Failed to get total count: ${countError.message}`);
    }

    const { data, error } = await baseQuery
      .order(sortBy, sortOrder)
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch history: ${error.message}`);
    }

    const total = totalCount || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: data || [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  @ApiOperation({
    summary: 'Delete Analysis Record',
    description:
      'Delete a video analysis record and associated thumbnail. Requires special permissions and user ownership verification.',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique identifier for the analysis record to delete',
    example: 'audit_uuid_123',
  })
  @ApiResponse({
    status: 200,
    description: 'Analysis record deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Audit deleted successfully' },
        deletedId: { type: 'string', example: 'audit_uuid_123' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Audit not found or unauthorized' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiSecurity('bearer')
  @Delete('delete/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequirePermissions('canDeleteAnyContent')
  async deleteAudit(
    @Param('id') auditId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;

    try {
      // Delete the audit and get thumbnail info
      const deletedAudit = await this.auditRepo.deleteAudit(auditId, userId);

      // Capture snapshot for audit trail
      const auditSnapshot = {
        id: deletedAudit.id,
        thumbnailUrl: deletedAudit.thumbnail_url,
      };

      // If there's a thumbnail, delete it from storage
      if (deletedAudit.thumbnail_url) {
        try {
          const accessToken =
            req.headers.authorization?.replace('Bearer ', '') ?? '';
          await this.storage.deleteFile(
            deletedAudit.id,
            deletedAudit.thumbnail_url,
            accessToken,
          );
        } catch (storageError) {
          console.warn(
            'Failed to delete thumbnail from storage:',
            storageError,
          );
        }
      }

      // Log audit deletion
      await this.userLogService.logActivity({
        userId,
        logType: LogType.ACTIVITY,
        activityType: 'analysis_deleted',
        description: 'User deleted an analysis record',
        severity: LogSeverity.INFO,
        ipAddress: req.ip,
        userAgent: String(req.headers['user-agent'] || 'unknown'),
        metadata: {
          auditId: deletedAudit.id,
          hadThumbnail: !!deletedAudit.thumbnail_url,
        },
      });

      // Audit trail for data deletion
      await this.logAggregatorService.logAuditTrail({
        actorId: userId,
        actorEmail: req.user?.email || 'unknown',
        actorRole: req.user?.role || 'user',
        action: 'delete_analysis',
        entityType: 'video_analysis',
        entityId: deletedAudit.id,
        oldValues: auditSnapshot,
        newValues: {
          deleted: true,
          deletedAt: new Date().toISOString(),
        },
        changes: ['analysis_deleted'],
        ipAddress: req.ip,
        userAgent: String(req.headers['user-agent'] || 'unknown'),
        metadata: {
          auditId: deletedAudit.id,
          hadThumbnail: !!deletedAudit.thumbnail_url,
          thumbnailDeleted: !!deletedAudit.thumbnail_url,
        },
      });

      return {
        success: true,
        message: 'Audit deleted successfully',
        deletedId: deletedAudit.id,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          throw new BadRequestException('Audit not found or unauthorized');
        }
      }
      throw error;
    }
  }
}
