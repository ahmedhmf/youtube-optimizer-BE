import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AiModule } from '../ai/ai.module';
import { YoutubeModule } from '../youtube/youtube.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuditRepository } from './audit.repository';

@Module({
  imports: [AiModule, YoutubeModule, SupabaseModule],
  controllers: [AuditController],
  providers: [AuditRepository],
})
export class AuditModule {}
