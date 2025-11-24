import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { v4 as uuidv4 } from 'uuid';
import { SystemLogService } from '../logging/services/system-log.service';
import { LogSeverity, SystemLogCategory } from '../logging/dto/log.types';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly systemLogService: SystemLogService,
  ) {}

  async uploadVideo(
    userId: string,
    file: Express.Multer.File,
    accessToken: string,
  ): Promise<{ publicUrl: string; key: string }> {
    // Use authenticated client
    const client = this.supabase.getAuthenticatedClient(accessToken);

    // Test authentication first
    const { data: authUser, error: authError } = await client.auth.getUser();

    if (authError || !authUser?.user) {
      throw new Error(
        `Authentication failed: ${authError?.message || 'No user found'}`,
      );
    }

    // Create file path with userId as first directory level (required for RLS)
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `${userId}/videos/${fileName}`;

    // Verify user IDs match
    if (userId !== authUser.user.id) {
      throw new Error('User ID mismatch between request and token');
    }

    const { error } = await client.storage
      .from('uploads')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      // Try with a different path structure
      const altFilePath = `${fileName}`;
      const { error: altError } = await client.storage
        .from('uploads')
        .upload(altFilePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (altError) {
        throw new Error(`Supabase upload failed: ${error.message}`);
      }

      // Get public URL for alternative path
      const { data: altUrlData } = client.storage
        .from('uploads')
        .getPublicUrl(altFilePath);

      await this.systemLogService.logSystem({
        logLevel: LogSeverity.WARNING,
        category: SystemLogCategory.STORAGE,
        serviceName: 'SupabaseStorageService',
        message: 'Video uploaded using alternative path after initial failure',
        details: {
          userId,
          fileName: file.originalname,
          fileSize: file.buffer.length,
          mimeType: file.mimetype,
          originalPath: filePath,
          alternativePath: altFilePath,
          originalError: error.message,
        },
        relatedEntityType: 'user',
        relatedEntityId: userId,
      });

      return {
        publicUrl: altUrlData.publicUrl,
        key: altFilePath,
      };
    }

    // Get public URL
    const { data: urlData } = client.storage
      .from('uploads')
      .getPublicUrl(filePath);

    await this.systemLogService.logSystem({
      logLevel: LogSeverity.INFO,
      category: SystemLogCategory.STORAGE,
      serviceName: 'SupabaseStorageService',
      message: 'Video uploaded successfully to Supabase storage',
      details: {
        userId,
        fileName: file.originalname,
        fileSize: file.buffer.length,
        mimeType: file.mimetype,
        storagePath: filePath,
      },
      relatedEntityType: 'user',
      relatedEntityId: userId,
    });

    return {
      publicUrl: urlData.publicUrl,
      key: filePath,
    };
  }

  async uploadThumbnail(
    userId: string,
    imageBuffer: Buffer,
    videoId: string,
    accessToken: string,
  ): Promise<string> {
    const client = this.supabase.getAuthenticatedClient(accessToken);

    // Create file path with userId as first directory level
    const fileName = `${videoId}_${uuidv4()}.jpg`;
    const filePath = `${userId}/thumbnails/${fileName}`;

    const { error } = await client.storage
      .from('uploads')
      .upload(filePath, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('Thumbnail upload error:', error);
      throw new Error(`Thumbnail upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = client.storage
      .from('uploads')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  async deleteFile(
    userId: string,
    filePath: string,
    accessToken: string,
  ): Promise<void> {
    const client = this.supabase.getAuthenticatedClient(accessToken);

    // Ensure the file path starts with userId for security
    const fullPath = filePath.startsWith(`${userId}/`)
      ? filePath
      : `${userId}/${filePath}`;

    const { error } = await client.storage.from('uploads').remove([fullPath]);

    if (error) {
      console.error('File deletion error:', error);
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }
}
