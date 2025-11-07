import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { YoutubeModule } from './youtube/youtube.module';
import { AiModule } from './ai/ai.module';
import { AuditModule } from './audit/audit.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [AuditModule, SupabaseModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
