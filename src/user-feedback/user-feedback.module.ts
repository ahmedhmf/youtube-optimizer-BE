import { Module } from '@nestjs/common';
import { UserFeedbackController } from './user-feedback.controller';
import { UserFeedbackService } from './user-feedback.service';
import { AuditLoggingService } from 'src/common/audit-logging.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [UserFeedbackController],
  providers: [UserFeedbackService, AuditLoggingService],
  exports: [UserFeedbackService],
})
export class UserFeedbackModule {}
