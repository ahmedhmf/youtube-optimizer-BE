import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditResponse } from './audit.types';

@Injectable()
export class AuditRepository {
  private readonly logger = new Logger(AuditRepository.name);

  constructor(private readonly supabase: SupabaseService) { }

  async saveAudit(userId: string, url: string, data: AuditResponse) {
    const client = this.supabase.getClient();
    const { video, suggestions } = data;

    const { data: savedAudit, error } = await client.from('audits').insert({
      user_id: userId,
      video_url: url,
      video_title: video.title,
      ai_titles: suggestions.titles,
      ai_description: suggestions.description,
      ai_tags: suggestions.tags,
      thumbnail_url: video.thumbnail,
      ai_image_prompt: suggestions.thumbnailPrompts,
    }).select().single();

    if (error) throw new Error(error.message);
    return savedAudit;
  }

  async countUserAudits(userId: string): Promise<number> {
    try {
      this.logger.log(`Counting audits for user: ${userId}`);
      const client = this.supabase.getClient();
      const { count, error } = await client
        .from('audits')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      if (error) {
        if (error.code === 'PGRST116') {
          this.logger.error('Table "audits" does not exist. Please run the database setup SQL.');
          throw new Error('Database table "audits" does not exist. Please check your database setup.');
        }
        this.logger.error('Supabase error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new Error(`Supabase error: ${error.message || 'Unknown error'} (Code: ${error.code || 'N/A'})`);
      }

      this.logger.log(`Found ${count ?? 0} audits for user ${userId}`);
      return count ?? 0;
    } catch (error) {
      this.logger.error('Error counting user audits:', error);
      throw error;
    }
  }

  async deleteAudit(auditId: string, userId: string): Promise<{ id: string; thumbnail_url?: string }> {
    const client = this.supabase.getClient();

    // First get the audit to check ownership and get thumbnail URL
    const { data: audit, error: fetchError } = await client
      .from('audits')
      .select('id, thumbnail_url')
      .eq('id', auditId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !audit) {
      throw new Error('Audit not found or unauthorized');
    }

    // Delete the audit
    const { error: deleteError } = await client
      .from('audits')
      .delete()
      .eq('id', auditId)
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error(`Failed to delete audit: ${deleteError.message}`);
    }

    return audit;
  }
}
