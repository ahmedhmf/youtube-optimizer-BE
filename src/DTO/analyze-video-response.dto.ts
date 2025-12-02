import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  TitleRewriteResult,
  DescriptionRewriteResult,
  KeywordExtractionResult,
  ChaptersResult,
} from '../ai/models/ai.types';

export class VideoInfoDto {
  @ApiProperty({ description: 'Original video title' })
  originalTitle: string;

  @ApiProperty({ description: 'YouTube video ID' })
  videoId: string;

  @ApiPropertyOptional({ description: 'Video duration' })
  duration?: string;
}

export class FileInfoDto {
  @ApiProperty({ description: 'Original filename' })
  originalName: string;

  @ApiProperty({ description: 'File size in bytes' })
  size: number;

  @ApiProperty({ description: 'MIME type' })
  mimeType: string;
}

export class VideoAnalysisDto {
  @ApiProperty({ description: 'Title rewrite suggestions' })
  titleRewrite: TitleRewriteResult;

  @ApiProperty({ description: 'SEO-optimized description' })
  descriptionRewrite: DescriptionRewriteResult;

  @ApiProperty({ description: 'Extracted keywords by category' })
  keywordExtraction: KeywordExtractionResult;

  @ApiProperty({ description: 'Generated chapters with timestamps' })
  chapters: ChaptersResult;
}

export class AnalyzeVideoResponseDto {
  @ApiProperty({ description: 'Success status', example: true })
  success: boolean;

  @ApiPropertyOptional({ description: 'Video metadata (for URL analysis)' })
  videoInfo?: VideoInfoDto;

  @ApiPropertyOptional({ description: 'File metadata (for file analysis)' })
  fileInfo?: FileInfoDto;

  @ApiProperty({ description: 'Complete video analysis results' })
  analysis: VideoAnalysisDto;

  @ApiProperty({ description: 'Length of transcript analyzed' })
  transcriptLength: number;
}
