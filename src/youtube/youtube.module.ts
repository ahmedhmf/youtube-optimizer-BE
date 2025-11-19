import { Module } from '@nestjs/common';
import { YoutubeService } from './youtube.service';
import { YoutubeController } from './youtube.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [YoutubeService],
  controllers: [YoutubeController],
  exports: [YoutubeService],
})
export class YoutubeModule {}
