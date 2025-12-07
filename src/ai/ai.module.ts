import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { WorkflowController } from './workflow.controller';
import { PromptsService } from './prompts.service';
import { ThumbnailComposerService } from './thumbnail-composer.service';
import { ThumbnailAssetsComposerService } from './thumbnail-assets-composer.service';
import { YoutubeModule } from '../youtube/youtube.module';
import { LoggingModule } from '../logging/logging.module';
import { UserPreferencesModule } from '../user-preferences/user-preferences.module';
import { NotificationModule } from '../notifications/notification.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    YoutubeModule,
    LoggingModule,
    UserPreferencesModule,
    NotificationModule,
    SupabaseModule,
    forwardRef(() => AuditModule),
  ],
  providers: [
    AiService,
    PromptsService,
    ThumbnailComposerService,
    ThumbnailAssetsComposerService,
  ],
  controllers: [AiController, WorkflowController],
  exports: [AiService],
})
export class AiModule {}
