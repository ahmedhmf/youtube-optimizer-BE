-- Run this migration to update the audits table for the new video analysis system
-- This adds new columns while keeping old ones for backward compatibility

\echo 'Starting migration: Update audits table for new analysis structure'

BEGIN;

-- Add new columns for enhanced analysis
ALTER TABLE public.audits
ADD COLUMN IF NOT EXISTS ai_titles_with_reasoning jsonb,
ADD COLUMN IF NOT EXISTS ai_description_detailed jsonb,
ADD COLUMN IF NOT EXISTS ai_keywords_categorized jsonb,
ADD COLUMN IF NOT EXISTS ai_chapters jsonb,
ADD COLUMN IF NOT EXISTS ai_thumbnail_ideas jsonb,
ADD COLUMN IF NOT EXISTS ai_thumbnail_ai_prompts text[];

-- Add column comments for documentation
COMMENT ON COLUMN public.audits.ai_titles_with_reasoning IS 'New format: { titles: string[], reasoning: string }';
COMMENT ON COLUMN public.audits.ai_description_detailed IS 'New format: { description: string, hashtags: string[], keyPoints: string[] }';
COMMENT ON COLUMN public.audits.ai_keywords_categorized IS 'New format: { primaryKeywords: string[], longTailKeywords: string[], trendingKeywords: string[], competitorKeywords: string[] }';
COMMENT ON COLUMN public.audits.ai_chapters IS 'New format: { chapters: [{ timestamp: string, title: string, description: string }], totalDuration: string }';
COMMENT ON COLUMN public.audits.ai_thumbnail_ideas IS 'New format: array of { textOverlay: string, concept: string, visualElements: string[], colorScheme: string, composition: string }';
COMMENT ON COLUMN public.audits.ai_thumbnail_ai_prompts IS 'Array of AI image generation prompts';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audits_keywords ON public.audits USING gin (ai_keywords_categorized);
CREATE INDEX IF NOT EXISTS idx_audits_chapters ON public.audits USING gin (ai_chapters);

\echo 'Migration completed successfully! New columns added to audits table.'
\echo 'Old columns (ai_titles, ai_description, ai_tags, ai_image_prompt) are kept for backward compatibility.'
\echo ''
\echo 'Next steps:'
\echo '1. Restart your application'
\echo '2. Test the queue system with a YouTube video'
\echo '3. Verify the new analysis structure is saved correctly'
\echo '4. After confirming everything works, you can optionally drop old columns'

COMMIT;
