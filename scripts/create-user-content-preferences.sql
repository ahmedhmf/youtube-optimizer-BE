-- Migration: Add user content preferences table
-- Date: 2024
-- Description: Stores user preferences for content creation style

-- Step 1: Create user_content_preferences table
CREATE TABLE IF NOT EXISTS public.user_content_preferences (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  tone TEXT,
  thumbnail_style TEXT,
  image_style TEXT,
  language TEXT,
  custom_instructions TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT user_content_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS user_content_preferences_user_id_idx ON public.user_content_preferences(user_id);
CREATE INDEX IF NOT EXISTS user_content_preferences_is_completed_idx ON public.user_content_preferences(is_completed);

-- Step 3: Enable RLS
ALTER TABLE public.user_content_preferences ENABLE ROW LEVEL SECURITY;

-- Step 4: RLS Policies
CREATE POLICY "Users can view own preferences"
ON public.user_content_preferences
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
ON public.user_content_preferences
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
ON public.user_content_preferences
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can manage preferences"
ON public.user_content_preferences
USING (true)
WITH CHECK (true);

-- Step 5: Add comment
COMMENT ON TABLE public.user_content_preferences IS 'User preferences for AI content generation style';
COMMENT ON COLUMN public.user_content_preferences.tone IS 'Preferred tone for content (e.g., casual, professional, enthusiastic)';
COMMENT ON COLUMN public.user_content_preferences.thumbnail_style IS 'Preferred thumbnail style';
COMMENT ON COLUMN public.user_content_preferences.image_style IS 'Preferred AI image generation style';
COMMENT ON COLUMN public.user_content_preferences.language IS 'Preferred language for content generation';
COMMENT ON COLUMN public.user_content_preferences.custom_instructions IS 'Custom instructions for AI content generation';
COMMENT ON COLUMN public.user_content_preferences.is_completed IS 'Whether user has completed preference setup';

-- Verify the table
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_content_preferences'
ORDER BY ordinal_position;
