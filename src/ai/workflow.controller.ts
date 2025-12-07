import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
  Req,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService } from './ai.service';
import { YoutubeService } from '../youtube/youtube.service';
import type { AuthenticatedRequest } from '../audit/models/authenticated-request.model';

interface WorkflowAnalysisDto {
  videoUrl: string;
}

interface WorkflowResponse {
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string;
  videoId: string;
}

interface GenerateContentDto {
  videoUrl: string;
  fields: ('title' | 'description' | 'tags' | 'seoKeywords')[];
  originalTitle?: string;
}

interface GenerateContentResponse {
  title?: string[];
  description?: {
    description: string;
    hashtags: string[];
    keyPoints: string[];
  };
  tags?: string[];
  seoKeywords?: {
    primaryKeywords: string[];
    longTailKeywords: string[];
    trendingKeywords: string[];
    competitorKeywords: string[];
  };
}

@Controller('workflow')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly youtubeService: YoutubeService,
  ) {}

  @Post('analyze')
  async analyzeVideo(
    @Body() body: WorkflowAnalysisDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<WorkflowResponse> {
    const userId = req.user?.id;

    if (!userId) {
      throw new HttpException(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!body.videoUrl) {
      throw new HttpException('videoUrl is required', HttpStatus.BAD_REQUEST);
    }

    try {
      this.logger.log(`Starting workflow analysis for video: ${body.videoUrl}`);

      // Step 1: Get video data from YouTube
      this.logger.log('Fetching video data from YouTube...');
      const videoData = await this.youtubeService.getVideoData(body.videoUrl);

      // Step 2: Get transcript
      this.logger.log('Fetching video transcript...');
      const transcript = await this.youtubeService.getVideoTranscript(
        body.videoUrl,
      );

      if (!transcript) {
        throw new HttpException(
          'Failed to get video transcript',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Step 3: Detect category using AI
      this.logger.log('Detecting video category...');
      const category = await this.aiService.detectVideoCategory(
        userId,
        videoData.title,
        videoData.description,
        transcript,
      );

      this.logger.log('Workflow analysis completed successfully');

      return {
        title: videoData.title,
        description: videoData.description,
        category,
        thumbnailUrl: videoData.thumbnail,
        videoId: videoData.id,
      };
    } catch (error) {
      this.logger.error('Workflow analysis failed:', error);
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to analyze video',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate-content')
  async generateContent(
    @Body()
    body: {
      videoUrl: string;
      fields: Array<
        'title' | 'description' | 'tags' | 'keywords' | 'thumbnail'
      >;
    },
    @Req() req: AuthenticatedRequest,
  ): Promise<{
    title?: string[];
    description?: string;
    tags?: string[];
    keywords?: {
      primaryKeywords: string[];
      longTailKeywords: string[];
      trendingKeywords: string[];
      competitorKeywords: string[];
    };
    thumbnail?: {
      template: string;
    };
  }> {
    const userId = req.user?.id;

    if (!userId) {
      throw new HttpException(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!body.videoUrl || !body.fields || body.fields.length === 0) {
      throw new HttpException(
        'videoUrl and fields array are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      this.logger.log(
        `Generating content for video: ${body.videoUrl}, fields: ${body.fields.join(', ')}`,
      );

      // Step 1: Get video data
      const videoData = await this.youtubeService.getVideoData(body.videoUrl);

      // Step 2: Get transcript
      this.logger.log('Fetching video transcript...');
      const transcript = await this.youtubeService.getVideoTranscript(
        body.videoUrl,
      );

      if (!transcript) {
        throw new HttpException(
          'Failed to get video transcript',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result: {
        title?: string[];
        description?: string;
        tags?: string[];
        keywords?: {
          primaryKeywords: string[];
          longTailKeywords: string[];
          trendingKeywords: string[];
          competitorKeywords: string[];
        };
        thumbnail?: {
          template: string;
        };
      } = {};

      // Step 3: Generate requested fields in parallel
      const promises: Promise<void>[] = [];

      if (body.fields.includes('thumbnail')) {
        this.logger.log('Detecting thumbnail template...');
        promises.push(
          this.aiService
            .selectThumbnailTemplate(videoData.title, transcript)
            .then((template) => {
              result.thumbnail = {
                template,
              };
            }),
        );
      }

      if (body.fields.includes('title')) {
        this.logger.log('Generating optimized titles...');
        promises.push(
          this.aiService
            .generateTitleRewrite(userId, transcript, videoData.title)
            .then((titleResult) => {
              result.title = titleResult.titles;
            }),
        );
      }

      if (body.fields.includes('description')) {
        this.logger.log('Generating optimized description...');
        promises.push(
          this.aiService
            .generateDescriptionRewrite(userId, transcript)
            .then((descResult) => {
              result.description = descResult.description;
              // Also include hashtags as tags if tags were requested
              if (body.fields.includes('tags') && !result.tags) {
                result.tags = descResult.hashtags;
              }
            }),
        );
      }

      if (body.fields.includes('keywords')) {
        this.logger.log('Extracting SEO keywords...');
        promises.push(
          this.aiService.extractKeywords(transcript).then((keywordResult) => {
            result.keywords = {
              primaryKeywords: keywordResult.primaryKeywords,
              longTailKeywords: keywordResult.longTailKeywords,
              trendingKeywords: keywordResult.trendingKeywords,
              competitorKeywords: keywordResult.competitorKeywords,
            };
          }),
        );
      }

      if (
        body.fields.includes('tags') &&
        !body.fields.includes('description')
      ) {
        // Generate tags separately if description is not requested
        this.logger.log('Generating tags...');
        promises.push(
          this.aiService
            .generateDescriptionRewrite(userId, transcript)
            .then((descResult) => {
              result.tags = descResult.hashtags;
            }),
        );
      }

      // Wait for all requested generations to complete
      await Promise.all(promises);

      this.logger.log('Content generation completed successfully');

      return result;
    } catch (error) {
      this.logger.error('Content generation failed:', error);
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to generate content',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate-thumbnail')
  async generateCompleteThumbnail(
    @Body()
    body: {
      videoUrl: string;
      template: string;
      templateData: Record<string, any>;
      brandLogo?: {
        url: string;
        position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
        size: 'small' | 'medium' | 'large';
      };
      watermark?: string;
    },
    @Req() req: AuthenticatedRequest,
  ): Promise<{
    thumbnailUrl: string;
    template: string;
    message: string;
  }> {
    const userId = req.user?.id;

    if (!userId) {
      throw new HttpException(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!body.videoUrl || !body.template || !body.templateData) {
      throw new HttpException(
        'videoUrl, template, and templateData are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      this.logger.log(
        `Generating complete thumbnail for video: ${body.videoUrl}, template: ${body.template}`,
      );
      this.logger.log(
        `Request body: ${JSON.stringify(body, null, 2)}`,
      );

      // Step 1: Get video data and transcript
      const videoData = await this.youtubeService.getVideoData(body.videoUrl);
      const transcript = await this.youtubeService.getVideoTranscript(
        body.videoUrl,
      );

      if (!transcript) {
        throw new HttpException(
          'Failed to get video transcript',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Step 2: Generate complete thumbnail with user assets
      const thumbnailUrl = await this.aiService.generateCompleteThumbnail(
        userId,
        videoData.id,
        videoData.title,
        transcript,
        body.template,
        body.templateData,
        body.brandLogo,
        body.watermark,
      );

      this.logger.log('Complete thumbnail generated successfully');

      return {
        thumbnailUrl,
        template: body.template,
        message: 'Thumbnail generated successfully',
      };
    } catch (error) {
      this.logger.error('Thumbnail generation failed:', error);
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to generate thumbnail',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
