// apps/api/src/modules/audit/audit.types.ts
import { YouTubeVideo } from '../../youtube/youtube.types';
import type {
  TitleRewriteResult,
  DescriptionRewriteResult,
  KeywordExtractionResult,
  ChaptersResult,
  ThumbnailIdeaResult,
} from '../../ai/models/ai.types';

// New enhanced audit response
export interface AuditResponse {
  video: YouTubeVideo;
  analysis: {
    titleRewrite: TitleRewriteResult;
    descriptionRewrite: DescriptionRewriteResult;
    keywordExtraction: KeywordExtractionResult;
    chapters: ChaptersResult;
    thumbnailIdeas?: ThumbnailIdeaResult[];
    thumbnailAIPrompts?: string[];
    thumbnailUrl?: string;
  };
}
