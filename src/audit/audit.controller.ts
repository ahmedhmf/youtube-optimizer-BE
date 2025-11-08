import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { YoutubeService } from '../youtube/youtube.service';
import { AiService } from '../ai/ai.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditRepository } from './audit.repository';
import { AuditResponse } from './audit.types';
import { SupabaseAuthGuard } from 'src/common/supabase-auth.guard';
import { AiMessageConfiguration } from 'src/model/ai-configuration.model';
import { SupabaseStorageService } from 'src/supabase/supabase-storage.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import path from 'path';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';

const ALLOWED = ['video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/mp3', 'audio/wav'];

@Controller('analyze')
export class AuditController {
  constructor(
    private readonly youtubeService: YoutubeService,
    private readonly aiService: AiService,
    private readonly auditRepo: AuditRepository,
    private readonly supabase: SupabaseService,
    private readonly storage: SupabaseStorageService,

  ) { }

  @Post('video')
  @UseGuards(SupabaseAuthGuard)
  async analyzeVideo(
    @Body() body: { configuration: AiMessageConfiguration },
    @Req() req,
  ): Promise<any> {
    try {
      const userId = req.user.id;
      const email = req.user.email;

      // Check usage limit
      const usedCount = await this.auditRepo.countUserAudits(userId);
      const maxFree = 100;
      if (usedCount >= maxFree) {
        throw new Error('Free plan limit reached. Please upgrade.');
      }

      // Process the video
      const video = await this.youtubeService.getVideoData(body.configuration.url);
      console.log('Fetched video data:', body);
      const suggestions = await this.aiService.generateVideoSuggestions(video, body.configuration.language, body.configuration.tone, body.configuration.model);
      const response: AuditResponse = { video, suggestions };

      // Save the audit and get the saved item
      const savedAudit = await this.auditRepo.saveAudit(userId, body.configuration.url, response);

      // Log usage event
      const client = this.supabase.getClient();
      await client.from('usage_events').insert({
        user_id: userId,
        event_type: 'audit_created',
      });

      // Return only the newly saved audit item
      return savedAudit;
    } catch (error) {
      throw error;
    }
  }

  @Post('upload')
  @UseGuards(SupabaseAuthGuard)
  @UseInterceptors(FileInterceptor('video', {
    storage: memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  }))
  async analyzeUploadedVideo(
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    if (!file) throw new BadRequestException('No video file uploaded (field name: video).');
    if (!ALLOWED.includes(file.mimetype))
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);

    const userId = req.user.id;
    const accessToken = req.headers.authorization?.replace('Bearer ', ''); // Extract token from header

    const { publicUrl, key } = await this.storage.uploadVideo(userId, file, accessToken);
    const tmpPath = path.join(os.tmpdir(), `${Date.now()}-${file.originalname}`);
    await fs.writeFile(tmpPath, file.buffer);
    const transcript = await this.aiService.transcribeLocalFile(tmpPath).finally(async () => {
      try { await fs.unlink(tmpPath); } catch { }
    });
    const summary = await this.aiService.summarizeTranscript(transcript);
    const suggestions = await this.aiService.generateVideoSuggestionsFromText(
      `${summary}\n\n---- FULL TRANSCRIPT ----\n${transcript}`
    );
    const response = {
      video: {
        id: key,
        title: suggestions.titles?.[0] ?? 'Draft Video',
        description: summary,
        tags: suggestions.tags,
        thumbnail: publicUrl,
        views: 0
      },
      suggestions
    };

    const audit: AuditResponse = {
      video: {
        id: response.video.id,
        title: response.video.title,
        description: response.video.description,
        tags: response.video.tags,
        thumbnail: response.video.thumbnail,
        publishedAt: '',
        duration: '',
        views: 0,
        likes: 0,
        comments: 0
      },
      suggestions: response.suggestions
    }

    await this.auditRepo.saveAudit(userId, publicUrl, audit);

    return { publicUrl, transcript, summary, suggestions };
  }

  @Post('transcript')
  @UseGuards(SupabaseAuthGuard)
  async analyzeTranscript(
    @Body() body: { configuration: AiMessageConfiguration, transcript: string },
    @Req() req,
  ): Promise<any> {
    try {
      const userId = req.user.id;
      const email = req.user.email;

      // Check usage limit
      const usedCount = await this.auditRepo.countUserAudits(userId);
      const maxFree = 100;
      if (usedCount >= maxFree) {
        throw new Error('Free plan limit reached. Please upgrade.');
      }

      // Process the video
      const summary = await this.aiService.summarizeTranscript(body.transcript);
      // 5) Generate suggestions from transcript/summary
      const suggestions = await this.aiService.generateVideoSuggestionsFromText(
        `${summary}\n\n---- FULL TRANSCRIPT ----\n${body.transcript}`
      );

      // 6) Save audit row (type: draft_upload)
      const response = {
        video: {
          id: 'transcript-' + Date.now(),
          title: suggestions.titles?.[0] ?? 'Draft Video',
          description: summary,
          tags: suggestions.tags,
          thumbnail: '',
          views: 0
        },
        suggestions
      };

      const audit: AuditResponse = {
        video: {
          id: response.video.id,
          title: response.video.title,
          description: response.video.description,
          tags: response.video.tags,
          thumbnail: response.video.thumbnail,
          publishedAt: '',
          duration: '',
          views: 0,
          likes: 0,
          comments: 0
        },
        suggestions: response.suggestions
      }

      await this.auditRepo.saveAudit(userId, '', audit);

      return { publicUrl: '', transcript: body.transcript, summary, suggestions };
    } catch (error) {
      throw error;
    }
  }


  @Get('history')
  @UseGuards(SupabaseAuthGuard)
  async getUserHistory(@Req() req) {
    const userId = req.user.id;
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('audits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  @Delete('delete/:id')
  @UseGuards(SupabaseAuthGuard)
  async deleteAudit(@Param('id') auditId: string, @Req() req) {
    try {
      const userId = req.user.id;

      // Delete audit using repository
      await this.auditRepo.deleteAudit(auditId, userId);

      return { message: 'Audit deleted successfully', id: auditId };
    } catch (error) {
      throw error;
    }
  }
}
