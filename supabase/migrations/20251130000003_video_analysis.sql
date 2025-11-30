-- Video analysis and audit tables
-- Core functionality for YouTube video optimization

-- Audits table (video analysis results)
CREATE TABLE IF NOT EXISTS public.audits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  video_url text NOT NULL,
  video_title text,
  ai_titles text[],
  ai_description text,
  ai_tags text[],
  thumbnail_url text,
  ai_image_prompt text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audits_pkey PRIMARY KEY (id),
  CONSTRAINT audits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Video analysis logs table (detailed analysis tracking)
CREATE TABLE IF NOT EXISTS public.video_analysis_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  audit_id uuid,
  video_id character varying NOT NULL,
  video_url text NOT NULL,
  video_title text,
  analysis_type character varying NOT NULL,
  status character varying NOT NULL,
  stage character varying,
  progress_percentage integer DEFAULT 0,
  tokens_consumed integer DEFAULT 0,
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  model_used character varying,
  cost_usd numeric,
  processing_time_ms integer,
  error_message text,
  error_code character varying,
  retry_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  results jsonb,
  initiated_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  failed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT video_analysis_logs_pkey PRIMARY KEY (id),
  CONSTRAINT video_analysis_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT video_analysis_logs_audit_id_fkey FOREIGN KEY (audit_id) REFERENCES public.audits(id) ON DELETE SET NULL
);

-- User token usage tracking
CREATE TABLE IF NOT EXISTS public.user_token_usage (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  feature_type character varying NOT NULL,
  tokens_consumed integer NOT NULL DEFAULT 0,
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT user_token_usage_pkey PRIMARY KEY (id),
  CONSTRAINT user_token_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS audits_user_id_idx ON public.audits(user_id);
CREATE INDEX IF NOT EXISTS audits_created_at_idx ON public.audits(created_at);
CREATE INDEX IF NOT EXISTS audits_video_url_idx ON public.audits(video_url);

CREATE INDEX IF NOT EXISTS video_analysis_logs_user_id_idx ON public.video_analysis_logs(user_id);
CREATE INDEX IF NOT EXISTS video_analysis_logs_audit_id_idx ON public.video_analysis_logs(audit_id);
CREATE INDEX IF NOT EXISTS video_analysis_logs_video_id_idx ON public.video_analysis_logs(video_id);
CREATE INDEX IF NOT EXISTS video_analysis_logs_status_idx ON public.video_analysis_logs(status);
CREATE INDEX IF NOT EXISTS video_analysis_logs_created_at_idx ON public.video_analysis_logs(created_at);

CREATE INDEX IF NOT EXISTS user_token_usage_user_id_idx ON public.user_token_usage(user_id);
CREATE INDEX IF NOT EXISTS user_token_usage_feature_type_idx ON public.user_token_usage(feature_type);
CREATE INDEX IF NOT EXISTS user_token_usage_created_at_idx ON public.user_token_usage(created_at);

-- Enable RLS
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_analysis_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_token_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own audits" ON public.audits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own audits" ON public.audits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own video analysis logs" ON public.video_analysis_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own token usage" ON public.user_token_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE public.audits IS 'Stores YouTube video analysis results with AI-generated suggestions';
COMMENT ON TABLE public.video_analysis_logs IS 'Detailed logs of video analysis operations including tokens and costs';
COMMENT ON TABLE public.user_token_usage IS 'Tracks AI token consumption per user and feature';
