// apps/api/src/modules/youtube/youtube.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { YouTubeVideo } from './youtube.types';
import { HttpService } from '@nestjs/axios';
import { SystemLogService } from '../logging/services/system-log.service';
import { LogSeverity, SystemLogCategory } from '../logging/dto/log.types';
import { Innertube } from 'youtubei.js';

interface TranscriptSegment {
  snippet?: {
    text?: string;
  };
  start_ms?: number;
  duration_ms?: number;
}

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

  /**
   * Fetch video transcript using YouTube's internal API (youtubei.js)
   * More reliable than youtube-transcript package
   * @param url - YouTube video URL
   * @returns Transcript text as a single string
   */
  /* eslint-disable @typescript-eslint/no-unsafe-member-access */
  async getVideoTranscript(url: string): Promise<string> {
    const videoId = this.extractVideoId(url);
    const startTime = Date.now();

    try {
      // Initialize YouTube client
      const youtube = await Innertube.create({
        // Disable cache to avoid stale data
        cache: undefined,
      });

      // Get basic video info and transcript
      // Using try-catch to handle parsing errors gracefully
      let transcriptData: any;
      try {
        const info = await youtube.getBasicInfo(videoId);
        transcriptData = await info.getTranscript();
      } catch {
        // If getBasicInfo fails, try alternative method
        this.logger.warn(
          `getBasicInfo failed for ${videoId}, trying alternative method`,
        );
        const info = await youtube.getInfo(videoId);
        transcriptData = await info.getTranscript();
      }

      if (!transcriptData) {
        throw new Error('No transcript available for this video');
      }

      // Extract text from transcript segments
      const segments: TranscriptSegment[] =
        (transcriptData.transcript?.content?.body
          ?.initial_segments as TranscriptSegment[]) || [];

      const transcriptText: string = segments
        .map((segment) => segment.snippet?.text || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!transcriptText) {
        throw new Error('Transcript content is empty');
      }

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'YoutubeService',
        message: 'YouTube transcript fetched successfully (youtubei.js)',
        details: {
          videoId,
          transcriptLength: transcriptText.length,
          segmentCount: segments.length,
          responseTimeMs: responseTime,
        },
      });

      return transcriptText;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'YoutubeService',
        message: 'Failed to fetch YouTube transcript (youtubei.js)',
        details: {
          videoId,
          url,
          responseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });

      throw new Error(
        `Failed to fetch transcript: ${error instanceof Error ? error.message : 'Unknown error'}. Transcript may be disabled for this video.`,
      );
    }
  }
  /* eslint-enable @typescript-eslint/no-unsafe-member-access */

  /**
   * Fetch video transcript with timestamps using youtubei.js
   * @param url - YouTube video URL
   * @returns Array of transcript segments with timestamps and text
   */
  /* eslint-disable @typescript-eslint/no-unsafe-member-access */
  async getVideoTranscriptWithTimestamps(
    url: string,
  ): Promise<{ text: string; startMs: number; durationMs: number }[]> {
    const videoId = this.extractVideoId(url);
    const startTime = Date.now();

    try {
      const youtube = await Innertube.create({
        cache: undefined,
      });

      // Try getBasicInfo first, fallback to getInfo if it fails
      let transcriptData: any;
      try {
        const info = await youtube.getBasicInfo(videoId);
        transcriptData = await info.getTranscript();
      } catch {
        this.logger.warn(`getBasicInfo failed for ${videoId}, trying getInfo`);
        const info = await youtube.getInfo(videoId);
        transcriptData = await info.getTranscript();
      }

      if (!transcriptData) {
        throw new Error('No transcript available for this video');
      }

      // Extract segments with timestamps
      const initialSegments: TranscriptSegment[] =
        (transcriptData.transcript?.content?.body
          ?.initial_segments as TranscriptSegment[]) || [];

      const segments: { text: string; startMs: number; durationMs: number }[] =
        initialSegments.map((segment) => ({
          text: (segment.snippet?.text as string) || '',
          startMs: (segment.start_ms as number) || 0,
          durationMs: (segment.duration_ms as number) || 0,
        }));

      if (segments.length === 0) {
        throw new Error('No transcript segments found');
      }

      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.INFO,
        category: SystemLogCategory.NETWORK,
        serviceName: 'YoutubeService',
        message:
          'YouTube transcript with timestamps fetched successfully (youtubei.js)',
        details: {
          videoId,
          segmentCount: segments.length,
          responseTimeMs: responseTime,
        },
      });

      return segments;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.ERROR,
        category: SystemLogCategory.NETWORK,
        serviceName: 'YoutubeService',
        message:
          'Failed to fetch YouTube transcript with timestamps (youtubei.js)',
        details: {
          videoId,
          url,
          responseTimeMs: responseTime,
          error: error instanceof Error ? error.message : String(error),
        },
        stackTrace: error instanceof Error ? error.stack : undefined,
      });

      throw new Error(
        `Failed to fetch transcript: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
  /* eslint-enable @typescript-eslint/no-unsafe-member-access */
}
