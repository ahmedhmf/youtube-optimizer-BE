// apps/api/src/modules/youtube/youtube.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { YouTubeVideo } from './youtube.types';
import { HttpService } from '@nestjs/axios';
import { SystemLogService } from '../logging/services/system-log.service';
import { LogSeverity, SystemLogCategory } from '../logging/dto/log.types';

interface YouTubeApiResponse {
  items?: {
    snippet: {
      title: string;
      description: string;
      tags?: string[];
      thumbnails?: {
        high?: {
          url: string;
        };
      };
      publishedAt: string;
    };
    contentDetails: {
      duration: string;
    };
    statistics: {
      viewCount: string;
      likeCount: string;
      commentCount?: string;
    };
  }[];
}

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);

  constructor(
    private readonly http: HttpService,
    private readonly systemLogService: SystemLogService,
  ) {}

  /**
   * Fetch metadata from YouTube Data API by video URL.
   */
  async getVideoData(url: string): Promise<YouTubeVideo> {
    const id = this.extractVideoId(url);
    const apiKey = process.env.YOUTUBE_API_KEY;

    const endpoint = `https://www.googleapis.com/youtube/v3/videos?id=${id}&part=snippet,contentDetails,statistics&key=${apiKey}`;

    const startTime = Date.now();
    try {
      const response = await firstValueFrom(
        this.http.get<YouTubeApiResponse>(endpoint),
      );

      const item = response.data.items?.[0];
      if (!item) {
        await this.systemLogService.logSystem({
          logLevel: LogSeverity.WARNING,
          category: SystemLogCategory.NETWORK,
          serviceName: 'YoutubeService',
          message: 'YouTube API returned no video data',
          details: { videoId: id, url },
        });
        throw new Error('Video not found or private');
      }

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'YoutubeService',
        message: 'YouTube API call successful',
        details: {
          videoId: id,
          videoTitle: item.snippet.title,
          responseTimeMs: responseTime,
          views: item.statistics.viewCount,
        },
      });

      return {
        id,
        title: item.snippet.title,
        description: item.snippet.description,
        tags: item.snippet.tags ?? [],
        thumbnail: item.snippet.thumbnails?.high?.url ?? '',
        publishedAt: item.snippet.publishedAt,
        duration: item.contentDetails.duration,
        views: Number(item.statistics.viewCount),
        likes: Number(item.statistics.likeCount),
        comments: Number(item.statistics.commentCount ?? 0),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'YoutubeService',
        message: 'YouTube API call failed',
        details: {
          videoId: id,
          url,
          responseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Extract video ID from various YouTube URL formats.
   */
  private extractVideoId(url: string): string {
    const regex = /(?:v=|\/)([0-9A-Za-z_-]{11})(?:[?&]|$)/;
    const match = url.match(regex);
    if (!match) throw new Error('Invalid YouTube URL');
    return match[1];
  }
}
