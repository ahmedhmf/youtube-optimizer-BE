import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { YoutubeService } from '../youtube/youtube.service';
import { AiService } from '../ai/ai.service';
import { AuditRepository } from './audit.repository';
import { SupabaseAuthGuard } from 'src/common/supabase-auth.guard';
import { AiMessageConfiguration } from 'src/model/ai-configuration.model';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseStorageService } from 'src/supabase/supabase-storage.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PaginationQueryDto } from 'src/DTO/pagination-query.dto';
import { DatabaseQueueService } from './database-queue.service'; // Add this import
import { PaginatedResponse } from 'src/model/paginated-responce.model';

const ALLOWED = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
];

@Controller('analyze')
export class AuditController {
  constructor(
    private readonly youtubeService: YoutubeService,
    private readonly aiService: AiService,
    private readonly auditRepo: AuditRepository,
    private readonly supabase: SupabaseService,
    private readonly storage: SupabaseStorageService,
    private readonly queueService: DatabaseQueueService, // Add this
  ) {}

  @Post('video')
  @UseGuards(SupabaseAuthGuard)
  async analyzeVideo(
    @Body() body: { configuration: AiMessageConfiguration },
    @Req() req,
  ): Promise<{ jobId: string; message: string }> {
    // Change return type
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

      return {
        jobId: queueJobId,
        message:
          'Video analysis queued successfully. Check job status for progress.',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to queue analysis: ${error.message}`,
      );
    }
  }

  @Post('upload')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(
    FileInterceptor('video', {
      storage: memoryStorage(),
      limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
    }),
  )
  async analyzeUploadedVideo(
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
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

      return {
        jobId: queueJobId,
        message:
          'Video upload queued successfully. Check job status for progress.',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to queue analysis: ${error.message}`,
      );
    }
  }

  @Post('transcript')
  @UseGuards(SupabaseAuthGuard)
  async analyzeTranscript(
    @Body() body: { configuration: AiMessageConfiguration; transcript: string },
    @Req() req,
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

      return {
        jobId: queueJobId,
        message:
          'Transcript analysis queued successfully. Check job status for progress.',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to queue analysis: ${error.message}`,
      );
    }
  }

  // NEW ENDPOINTS for job management
  @Get('job/:jobId/status')
  @UseGuards(SupabaseAuthGuard)
  async getJobStatus(@Param('jobId') jobId: string, @Req() req) {
    try {
      const status = await this.queueService.getJobStatus(jobId);

      // Ensure user can only see their own jobs
      if (status.data && status.data.userId !== req.user.id) {
        throw new BadRequestException('Unauthorized access to job');
      }
      console.log('Job Status:', status);
      return status;
    } catch (error) {
      throw new BadRequestException(
        `Failed to get job status: ${error.message}`,
      );
    }
  }

  @Post('job/:jobId/cancel')
  @UseGuards(SupabaseAuthGuard)
  async cancelJob(@Param('jobId') jobId: string, @Req() req) {
    try {
      const job = await this.queueService.getJobStatus(jobId);

      if (job.data && job.data.userId !== req.user.id) {
        throw new BadRequestException('Unauthorized access to job');
      }

      const cancelled = await this.queueService.cancelJob(jobId);
      return {
        cancelled,
        message: cancelled
          ? 'Job cancelled successfully'
          : 'Job not found or already completed',
      };
    } catch (error) {
      throw new BadRequestException(`Failed to cancel job: ${error.message}`);
    }
  }

  @Get('jobs')
  @UseGuards(SupabaseAuthGuard)
  async getUserJobs(@Req() req) {
    try {
      return await this.queueService.getUserJobs(req.user.id);
    } catch (error) {
      throw new BadRequestException(
        `Failed to get user jobs: ${error.message}`,
      );
    }
  }

  @Post('job/:jobId/retry')
  @UseGuards(SupabaseAuthGuard)
  async retryJob(@Param('jobId') jobId: string, @Req() req) {
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

      return {
        success: true,
        newJobId,
        message: 'Job has been queued for retry with a new job ID',
      };
    } catch (error) {
      throw new BadRequestException(`Failed to retry job: ${error.message}`);
    }
  }

  // Keep your existing endpoints as they are
  @Get('history')
  @UseGuards(SupabaseAuthGuard)
  async getUserHistory(
    @Query() query: PaginationQueryDto,
    @Req() req,
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

    try {
      // Build the base query
      let baseQuery = client
        .from('audits')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Add search functionality if provided
      if (search) {
        baseQuery = baseQuery.or(
          `audit_data->>video->title.ilike.%${search}%,audit_data->>video->description.ilike.%${search}%,url.ilike.%${search}%`,
        );
      }

      // Get total count first
      const { count: totalCount, error: countError } = await baseQuery;

      if (countError) {
        throw new Error(`Failed to get total count: ${countError.message}`);
      }

      // Get paginated data
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
    } catch (error) {
      throw error;
    }
  }

  @Delete('delete/:id')
  @UseGuards(SupabaseAuthGuard)
  async deleteAudit(@Param('id') auditId: string, @Req() req) {
    const userId = req.user.id;

    try {
      // Delete the audit and get thumbnail info
      const deletedAudit = await this.auditRepo.deleteAudit(auditId, userId);

      // If there's a thumbnail, delete it from storage
      if (deletedAudit.thumbnail_url) {
        try {
          const accessToken = req.headers.authorization?.replace('Bearer ', '');
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
          // Don't fail the whole operation if thumbnail deletion fails
        }
      }

      return {
        success: true,
        message: 'Audit deleted successfully',
        deletedId: deletedAudit.id,
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new BadRequestException('Audit not found or unauthorized');
      }
      throw error;
    }
  }
}
