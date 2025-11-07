// apps/api/src/modules/youtube/youtube.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { YoutubeService } from './youtube.service';

@Controller('youtube')
export class YoutubeController {
  constructor(private readonly yt: YoutubeService) {}

  @Get('video')
  async getVideo(@Query('url') url: string) {
    return this.yt.getVideoData(url);
  }
}
