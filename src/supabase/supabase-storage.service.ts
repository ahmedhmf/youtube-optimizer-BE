import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SupabaseStorageService {
  constructor(private readonly supabase: SupabaseService) {}

  async uploadVideo(userId: string, file: Express.Multer.File, accessToken: string): Promise<{ publicUrl: string; key: string }> {
    // Use authenticated client
    const client = this.supabase.getAuthenticatedClient(accessToken);
    
    // Test authentication first
    const { data: authUser, error: authError } = await client.auth.getUser();
    console.log('Auth test - User:', authUser?.user?.id);
    console.log('Auth test - Error:', authError);
    
    if (authError || !authUser?.user) {
      throw new Error(`Authentication failed: ${authError?.message || 'No user found'}`);
    }
    
    // Create file path with userId as first directory level (required for RLS)
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `${userId}/videos/${fileName}`;
    
    console.log('Upload details:');
    console.log('- User ID from request:', userId);
    console.log('- User ID from auth:', authUser.user.id);
    console.log('- File path:', filePath);
    console.log('- File size:', file.buffer.length);
    console.log('- Content type:', file.mimetype);
    
    // Verify user IDs match
    if (userId !== authUser.user.id) {
      throw new Error('User ID mismatch between request and token');
    }
    
    const { data, error } = await client.storage
      .from('uploads')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Try with a different path structure
      console.log('Trying alternative path structure...');
      const altFilePath = `${fileName}`;
      const { data: altData, error: altError } = await client.storage
        .from('uploads')
        .upload(altFilePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });
        
      if (altError) {
        throw new Error(`Supabase upload failed: ${error.message}`);
      }
      
      console.log('Alternative upload successful:', altData);
      
      // Get public URL for alternative path
      const { data: altUrlData } = client.storage
        .from('uploads')
        .getPublicUrl(altFilePath);

      return {
        publicUrl: altUrlData.publicUrl,
        key: altFilePath
      };
    }

    console.log('Upload successful:', data);

    // Get public URL
    const { data: urlData } = client.storage
      .from('uploads')
      .getPublicUrl(filePath);

    return {
      publicUrl: urlData.publicUrl,
      key: filePath
    };
  }

  async uploadThumbnail(userId: string, imageBuffer: Buffer, videoId: string, accessToken: string): Promise<string> {
    const client = this.supabase.getAuthenticatedClient(accessToken);
    
    // Create file path with userId as first directory level
    const fileName = `${videoId}_${uuidv4()}.jpg`;
    const filePath = `${userId}/thumbnails/${fileName}`;
    
    const { data, error } = await client.storage
      .from('uploads')
      .upload(filePath, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: false
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

  async deleteFile(userId: string, filePath: string, accessToken: string): Promise<void> {
    const client = this.supabase.getAuthenticatedClient(accessToken);
    
    // Ensure the file path starts with userId for security
    const fullPath = filePath.startsWith(`${userId}/`) ? filePath : `${userId}/${filePath}`;
    
    const { error } = await client.storage
      .from('uploads')
      .remove([fullPath]);

    if (error) {
      console.error('File deletion error:', error);
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }
}