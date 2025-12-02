-- Migration: Update audits table to support new video analysis structure
-- Date: 2025-11-30
-- Description: Adds new columns for enhanced video analysis (chapters, categorized keywords, etc.)

-- Add new columns for the enhanced analysis
ALTER TABLE public.audits
ADD COLUMN IF NOT EXISTS ai_titles_with_reasoning jsonb,
ADD COLUMN IF NOT EXISTS ai_description_detailed jsonb,
ADD COLUMN IF NOT EXISTS ai_keywords_categorized jsonb,
ADD COLUMN IF NOT EXISTS ai_chapters jsonb,
ADD COLUMN IF NOT EXISTS ai_thumbnail_ideas jsonb,
ADD COLUMN IF NOT EXISTS ai_thumbnail_ai_prompts text[];

-- Add comments for documentation
COMMENT ON COLUMN public.audits.ai_titles_with_reasoning IS 'New format: { titles: string[], reasoning: string }';
COMMENT ON COLUMN public.audits.ai_description_detailed IS 'New format: { description: string, hashtags: string[], keyPoints: string[] }';
COMMENT ON COLUMN public.audits.ai_keywords_categorized IS 'New format: { primaryKeywords: string[], longTailKeywords: string[], trendingKeywords: string[], competitorKeywords: string[] }';
COMMENT ON COLUMN public.audits.ai_chapters IS 'New format: { chapters: [{ timestamp: string, title: string, description: string }], totalDuration: string }';
COMMENT ON COLUMN public.audits.ai_thumbnail_ideas IS 'New format: array of { textOverlay: string, concept: string, visualElements: string[], colorScheme: string, composition: string }';
COMMENT ON COLUMN public.audits.ai_thumbnail_ai_prompts IS 'Array of AI image generation prompts';

-- Keep old columns for backward compatibility during transition
-- Later you can run: ALTER TABLE public.audits DROP COLUMN ai_titles, DROP COLUMN ai_description, DROP COLUMN ai_tags, DROP COLUMN ai_image_prompt;

-- Create an index on the new jsonb columns for better query performance
CREATE INDEX IF NOT EXISTS idx_audits_keywords ON public.audits USING gin (ai_keywords_categorized);
CREATE INDEX IF NOT EXISTS idx_audits_chapters ON public.audits USING gin (ai_chapters);
