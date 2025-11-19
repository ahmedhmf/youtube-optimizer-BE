// apps/api/src/modules/youtube/youtube.service.ts
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { YouTubeVideo } from './youtube.types';
import { HttpService } from '@nestjs/axios';

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
  constructor(private readonly http: HttpService) {}

  /**
   * Fetch metadata from YouTube Data API by video URL.
   */
  async getVideoData(url: string): Promise<YouTubeVideo> {
    const id = this.extractVideoId(url);
    const apiKey = process.env.YOUTUBE_API_KEY;

    const endpoint = `https://www.googleapis.com/youtube/v3/videos?id=${id}&part=snippet,contentDetails,statistics&key=${apiKey}`;
    const response = await firstValueFrom(
      this.http.get<YouTubeApiResponse>(endpoint),
    );

    const item = response.data.items?.[0];
    if (!item) throw new Error('Video not found or private');

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
