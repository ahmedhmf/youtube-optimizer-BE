import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AiModule } from '../ai/ai.module';
import { YoutubeModule } from '../youtube/youtube.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuditRepository } from './audit.repository';
import { DatabaseQueueService } from './database-queue.service'; // Add this
import { ScheduleModule } from '@nestjs/schedule'; // Add this for cron jobs

@Module({
  imports: [
    AiModule,
    YoutubeModule,
    SupabaseModule,
    ScheduleModule.forRoot(), // Add this to enable cron jobs
  ],
  controllers: [AuditController],
  providers: [AuditRepository, DatabaseQueueService], // Add DatabaseQueueService
  exports: [AuditRepository], // Export repository for other modules if needed
})
export class AuditModule {}
