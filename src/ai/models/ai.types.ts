// apps/api/src/modules/ai/ai.types.ts

// Individual analysis results
export interface TitleRewriteResult {
  titles: string[];
  reasoning?: string;
}

export interface DescriptionRewriteResult {
  description: string;
  hashtags: string[];
  keyPoints: string[];
}

export interface KeywordExtractionResult {
  primaryKeywords: string[];
  longTailKeywords: string[];
  trendingKeywords: string[];
  competitorKeywords: string[];
}

export interface ChapterTimestamp {
  timestamp: string;
  title: string;
  description: string;
}

export interface ChaptersResult {
  chapters: ChapterTimestamp[];
  totalDuration?: string;
}

export interface ThumbnailIdeaResult {
  textOverlay: string;
  concept: string;
  visualElements: string[];
  colorScheme: string;
  composition: string;
}

export interface ThumbnailGenerationResult {
  ideas: ThumbnailIdeaResult[];
  aiPrompts: string[];
}

// Complete video analysis result
export interface VideoAnalysisResult {
  //titleRewrite: TitleRewriteResult;
  descriptionRewrite: DescriptionRewriteResult;
  keywordExtraction: KeywordExtractionResult;
  chapters: ChaptersResult;
  thumbnailGeneration: ThumbnailGenerationResult;
}
