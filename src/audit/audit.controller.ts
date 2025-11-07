import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { YoutubeService } from '../youtube/youtube.service';
import { AiService } from '../ai/ai.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditRepository } from './audit.repository';
import { AuditResponse } from './audit.types';
import { SupabaseAuthGuard } from 'src/common/supabase-auth.guard';

@Controller('analyze')
export class AuditController {
  constructor(
    private readonly youtubeService: YoutubeService,
    private readonly aiService: AiService,
    private readonly auditRepo: AuditRepository,
    private readonly supabase: SupabaseService,
  ) { }

  @Post('video')
  @UseGuards(SupabaseAuthGuard)
  async analyzeVideo(
    @Body() body: { url: string },
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
      const video = await this.youtubeService.getVideoData(body.url);
      const suggestions = await this.aiService.generateVideoSuggestions(video);
      const response: AuditResponse = { video, suggestions };
      
      // Save the audit and get the saved item
      const savedAudit = await this.auditRepo.saveAudit(userId, body.url, response);
      
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
}
