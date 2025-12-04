import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { AiService } from './ai.service';
import { YoutubeService } from '../youtube/youtube.service';
import {
  AnalyzeVideoByUrlDto,
  AnalyzeVideoByTextDto,
  AnalyzeVideoByFileDto,
} from '../DTO/analyze-video.dto';
import { AnalyzeVideoResponseDto } from '../DTO/analyze-video-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as fs from 'fs';
import * as path from 'path';
import type { AuthenticatedRequest } from 'src/audit/models/authenticated-request.model';

@ApiTags('AI Video Analysis')
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly youtubeService: YoutubeService,
  ) {}

  @Post('analyze/url')
  @ApiOperation({
    summary: 'Analyze video from YouTube URL',
    description:
      'Fetches transcript from YouTube and generates optimized title, description, keywords, and chapters',
  })
  @ApiResponse({
    status: 200,
    description: 'Video analysis completed successfully',
    type: AnalyzeVideoResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'No transcript available for this video',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid YouTube URL',
  })
  async analyzeVideoByUrl(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AnalyzeVideoByUrlDto,
    @Query('languageOverride') languageOverride?: string,
    @Query('toneOverride') toneOverride?: string,
  ): Promise<AnalyzeVideoResponseDto> {
    try {
      const userId = req.user.id;

      // Step 1: Fetch transcript from YouTube
      const transcript = await this.youtubeService.getVideoTranscript(
        dto.videoUrl,
      );

      if (!transcript || transcript.length < 100) {
        throw new HttpException(
          {
            statusCode: HttpStatus.NOT_FOUND,
            message: 'No transcript available for this video',
            error: 'Transcript Not Found',
            details:
              'This video does not have captions/subtitles enabled or available.',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Step 2: Get video metadata for original title
      const videoData = await this.youtubeService.getVideoData(dto.videoUrl);

      // Step 3: Generate analysis using AI
      // Use query parameters as overrides, fallback to DTO values, then to user preferences
      const language = languageOverride || dto.language;
      const tone = toneOverride || dto.tone;

      const [titleRewrite, descriptionRewrite, keywordExtraction, chapters] =
        await Promise.all([
          this.aiService.generateTitleRewrite(
            userId,
            transcript,
            videoData.title,
            language,
            tone,
          ),
          this.aiService.generateDescriptionRewrite(
            userId,
            transcript,
            language,
          ),
          this.aiService.extractKeywords(transcript),
          this.aiService.generateChapters(transcript),
        ]);

      return {
        success: true,
        videoInfo: {
          originalTitle: videoData.title,
          videoId: videoData.id,
          duration: videoData.duration,
        },
        analysis: {
          titleRewrite,
          descriptionRewrite,
          keywordExtraction,
          chapters,
        },
        transcriptLength: transcript.length,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle specific error cases
      if (
        error instanceof Error &&
        (error.message.includes('No transcript') ||
          error.message.includes('Transcript may be disabled'))
      ) {
        throw new HttpException(
          {
            statusCode: HttpStatus.NOT_FOUND,
            message: 'No transcript available for this video',
            error: 'Transcript Not Found',
            details: error.message,
          },
          HttpStatus.NOT_FOUND,
        );
      }

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

  @Post('analyze/text')
  @ApiOperation({
    summary: 'Analyze video from transcript text',
    description:
      'Analyzes provided transcript text and generates optimized metadata',
  })
  @ApiResponse({
    status: 200,
    description: 'Text analysis completed successfully',
    type: AnalyzeVideoResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid transcript text',
  })
  async analyzeVideoByText(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AnalyzeVideoByTextDto,
    @Query('languageOverride') languageOverride?: string,
    @Query('toneOverride') toneOverride?: string,
  ): Promise<AnalyzeVideoResponseDto> {
    try {
      const userId = req.user.id;
      const transcript = dto.transcript;
      const language = languageOverride || dto.language;
      const tone = toneOverride || dto.tone;
      const originalTitle = dto.originalTitle || 'Untitled Video';

      // Generate analysis using AI
      const [titleRewrite, descriptionRewrite, keywordExtraction, chapters] =
        await Promise.all([
          this.aiService.generateTitleRewrite(
            userId,
            transcript,
            originalTitle,
            language,
            tone,
          ),
          this.aiService.generateDescriptionRewrite(
            userId,
            transcript,
            language,
          ),
          this.aiService.extractKeywords(transcript),
          this.aiService.generateChapters(transcript),
        ]);

      return {
        success: true,
        analysis: {
          titleRewrite,
          descriptionRewrite,
          keywordExtraction,
          chapters,
        },
        transcriptLength: transcript.length,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to analyze transcript',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('analyze/file')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Analyze video from audio/video file',
    description:
      'Transcribes audio/video file using Whisper and generates optimized metadata',
  })
  @ApiResponse({
    status: 200,
    description: 'File analysis completed successfully',
    type: AnalyzeVideoResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file or file type',
  })
  async analyzeVideoByFile(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AnalyzeVideoByFileDto,
  ): Promise<AnalyzeVideoResponseDto> {
    let tmpPath: string | null = null;

    try {
      const userId = req.user.id;

      if (!file) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'No file uploaded',
            error: 'File Required',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate file type
      const allowedMimeTypes = [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/m4a',
        'audio/mp4',
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Invalid file type',
            error: 'File Type Not Supported',
            details: `Supported types: audio (mp3, wav, m4a) and video (mp4, mov)`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Save file temporarily
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      tmpPath = path.join(uploadsDir, `${Date.now()}-${file.originalname}`);
      fs.writeFileSync(tmpPath, file.buffer);

      // Step 1: Transcribe audio/video file
      const transcript = await this.aiService.transcribeLocalFile(tmpPath);

      if (!transcript || transcript.length < 100) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: 'Transcription failed or audio is too short',
            error: 'Transcription Error',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Step 2: Generate analysis
      const language = dto.language;
      const tone = dto.tone;
      const originalTitle = dto.originalTitle || 'Untitled Video';

      const [titleRewrite, descriptionRewrite, keywordExtraction, chapters] =
        await Promise.all([
          this.aiService.generateTitleRewrite(
            userId,
            transcript,
            originalTitle,
            language,
            tone,
          ),
          this.aiService.generateDescriptionRewrite(
            userId,
            transcript,
            language,
          ),
          this.aiService.extractKeywords(transcript),
          this.aiService.generateChapters(transcript),
        ]);

      return {
        success: true,
        fileInfo: {
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
        },
        analysis: {
          titleRewrite,
          descriptionRewrite,
          keywordExtraction,
          chapters,
        },
        transcriptLength: transcript.length,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to analyze file',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      // Clean up temporary file
      if (tmpPath && fs.existsSync(tmpPath)) {
        try {
          fs.unlinkSync(tmpPath);
        } catch (cleanupError) {
          console.error('Failed to clean up temp file:', cleanupError);
        }
      }
    }
  }
}
