import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditController } from './audit.controller';
import { AiModule } from '../ai/ai.module';
import { YoutubeModule } from '../youtube/youtube.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { AuditRepository } from './audit.repository';
import { DatabaseQueueService } from './database-queue.service';
import { QueueGateway } from './queue.gateway';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [
    AiModule,
    YoutubeModule,
    SupabaseModule,
    AuthModule,
    ScheduleModule.forRoot(),
    NotificationModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuditController],
  providers: [AuditRepository, DatabaseQueueService, QueueGateway],
  exports: [AuditRepository],
})
export class AuditModule {}
