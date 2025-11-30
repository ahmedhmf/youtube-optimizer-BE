// apps/api/src/modules/youtube/youtube.controller.ts
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { YoutubeService } from './youtube.service';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import { CorrelationId } from '../logging/decorators/correlation-id.decorator';

@ApiTags('YouTube Integration')
@Controller('youtube')
export class YoutubeController {
  constructor(
    private readonly yt: YoutubeService,
    private readonly logger: StructuredLoggerService,
  ) {}

  @Get('video')
  @ApiOperation({
    summary: 'Fetch YouTube Video Metadata',
    description:
      'Retrieves comprehensive metadata for a YouTube video including title, description, tags, thumbnails, and engagement metrics. No authentication required.',
  })
  @ApiQuery({
    name: 'url',
    description: 'YouTube video URL to fetch metadata for',
    example: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Video metadata retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'dQw4w9WgXcQ' },
        title: { type: 'string', example: 'Amazing Tutorial Video' },
        description: { type: 'string', example: 'Learn how to...' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          example: ['tutorial', 'education', 'howto'],
        },
        thumbnail: {
          type: 'string',
          example: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        },
        publishedAt: { type: 'string', format: 'date-time' },
        duration: { type: 'string', example: 'PT4M13S' },
        views: { type: 'number', example: 12345 },
        likes: { type: 'number', example: 567 },
        comments: { type: 'number', example: 89 },
        channelId: { type: 'string', example: 'UCChannelId123' },
        channelTitle: { type: 'string', example: 'Creator Channel' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid YouTube URL or video not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Invalid YouTube URL format' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found or unavailable',
  })
  async getVideo(
    @Query('url') url: string,
    @CorrelationId() correlationId: string,
  ) {
    // Log the incoming request
    this.logger.logWithCorrelation(
      'info',
      'Fetching YouTube video metadata',
      correlationId,
      'YoutubeController',
      { url },
    );

    if (!url) {
      this.logger.logWithCorrelation(
        'warn',
        'Missing YouTube URL parameter',
        correlationId,
        'YoutubeController',
      );
      throw new BadRequestException('YouTube URL is required');
    }

    // Basic URL validation
    const youtubeRegex =
      /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    if (!youtubeRegex.test(url)) {
      this.logger.logWithCorrelation(
        'warn',
        'Invalid YouTube URL format',
        correlationId,
        'YoutubeController',
        { url },
      );
      throw new BadRequestException('Invalid YouTube URL format');
    }

    try {
      const videoData = await this.yt.getVideoData(url);

      // Log successful video fetch
      this.logger.logBusinessEvent(
        correlationId,
        'YOUTUBE_VIDEO_FETCHED',
        undefined,
        {
          videoId: videoData.id,
          title: videoData.title,
          views: videoData.views,
        },
      );

      return videoData;
    } catch (error) {
      this.logger.logError(correlationId, error, 'YoutubeController', { url });
      throw error;
    }
  }
}
