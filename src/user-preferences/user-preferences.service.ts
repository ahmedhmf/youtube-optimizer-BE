import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  UserContentPreferences,
  CreateContentPreferencesDto,
  UpdateContentPreferencesDto,
} from './types/user-content-preferences.types';

@Injectable()
export class UserPreferencesService {
  private readonly logger = new Logger(UserPreferencesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get user content preferences
   */
  async getPreferences(userId: string): Promise<UserContentPreferences | null> {
    try {
      const client = this.supabase.getClient();

      const { data, error } = await client
        .from('user_content_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No preferences found
          return null;
        }
        throw error;
      }

      return this.mapToPreferences(data);
    } catch (error) {
      this.logger.error(
        `Error fetching preferences for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Check if user has completed preferences setup
   */
  async hasCompletedPreferences(userId: string): Promise<boolean> {
    const preferences = await this.getPreferences(userId);
    return preferences?.isCompleted || false;
  }

  /**
   * Create user content preferences
   */
  async createPreferences(
    userId: string,
    dto: CreateContentPreferencesDto,
  ): Promise<UserContentPreferences> {
    try {
      const client = this.supabase.getClient();

      const isCompleted = !!(
        dto.tone ||
        dto.thumbnailStyle ||
        dto.imageStyle ||
        dto.language
      );
      console.log(dto);
      const { data, error } = await client
        .from('user_content_preferences')
        .insert({
          user_id: userId,
          tone: dto.tone,
          thumbnail_style: dto.thumbnailStyle,
          image_style: dto.imageStyle,
          language: dto.language,
          custom_instructions: dto.customInstructions,
          is_completed: isCompleted,
        })
        .select()
        .single();

      if (error) throw error;

      this.logger.log(`Created preferences for user ${userId}`);
      return this.mapToPreferences(data);
    } catch (error) {
      this.logger.error(
        `Error creating preferences for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update user content preferences
   */
  async updatePreferences(
    userId: string,
    dto: UpdateContentPreferencesDto,
  ): Promise<UserContentPreferences> {
    try {
      const client = this.supabase.getClient();

      // Check if at least one field is filled to mark as completed
      const existing = await this.getPreferences(userId);
      const updatedData = { ...existing, ...dto };
      const isCompleted = !!(
        updatedData.tone ||
        updatedData.thumbnailStyle ||
        updatedData.imageStyle ||
        updatedData.language
      );
      console.log('isCompleted:', dto);
      const { data, error } = await client
        .from('user_content_preferences')
        .update({
          tone: dto.tone,
          thumbnail_style: dto.thumbnailStyle,
          image_style: dto.imageStyle,
          language: dto.language,
          custom_instructions: dto.customInstructions,
          is_completed: isCompleted,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      this.logger.log(`Updated preferences for user ${userId}`);
      return this.mapToPreferences(data);
    } catch (error) {
      this.logger.error(
        `Error updating preferences for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Upsert user content preferences (create or update)
   */
  async upsertPreferences(
    userId: string,
    dto: CreateContentPreferencesDto,
  ): Promise<UserContentPreferences> {
    try {
      const existing = await this.getPreferences(userId);

      if (existing) {
        // Update existing preferences
        return this.updatePreferences(userId, dto);
      } else {
        // Create new preferences
        return this.createPreferences(userId, dto);
      }
    } catch (error) {
      this.logger.error(
        `Error upserting preferences for user ${userId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Map database row to UserContentPreferences
   */
  private mapToPreferences(data: any): UserContentPreferences {
    return {
      id: data.id,
      userId: data.user_id,
      tone: data.tone,
      thumbnailStyle: data.thumbnail_style,
      imageStyle: data.image_style,
      language: data.language,
      customInstructions: data.custom_instructions,
      isCompleted: data.is_completed,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}
