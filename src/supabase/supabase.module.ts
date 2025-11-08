import { Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseController } from './supabase.controller';
import { SupabaseStorageService } from './supabase-storage.service';

@Module({
  providers: [SupabaseService, SupabaseStorageService],
  controllers: [SupabaseController],
  exports: [SupabaseService, SupabaseStorageService],
})
export class SupabaseModule {}
