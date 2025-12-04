import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { PromptsService } from './prompts.service';
import { YoutubeModule } from '../youtube/youtube.module';
import { LoggingModule } from '../logging/logging.module';
import { UserPreferencesModule } from '../user-preferences/user-preferences.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [
    YoutubeModule,
    LoggingModule,
    UserPreferencesModule,
    NotificationModule,
  ],
  providers: [AiService, PromptsService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
