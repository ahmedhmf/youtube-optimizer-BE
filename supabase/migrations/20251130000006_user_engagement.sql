-- User engagement and feedback tables
-- Tables for user feedback, feature requests, onboarding, and usage tracking

-- User feedback table
CREATE TABLE IF NOT EXISTS public.user_feedbacks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['bug_report'::character varying, 'feature_request'::character varying, 'improvement'::character varying, 'general'::character varying, 'usability'::character varying]::text[])),
  title character varying NOT NULL,
  description text NOT NULL,
  priority character varying CHECK (priority::text = ANY (ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying]::text[])),
  tags text[],
  current_page character varying,
  user_agent text,
  ip_address inet,
  status character varying NOT NULL DEFAULT 'new'::character varying CHECK (status::text = ANY (ARRAY['new'::character varying, 'in_review'::character varying, 'planned'::character varying, 'completed'::character varying, 'rejected'::character varying]::text[])),
  admin_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_feedbacks_pkey PRIMARY KEY (id),
  CONSTRAINT user_feedbacks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Feature requests table
CREATE TABLE IF NOT EXISTS public.feature_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature_name character varying NOT NULL,
  description text NOT NULL,
  use_case text NOT NULL,
  importance integer NOT NULL CHECK (importance >= 1 AND importance <= 10),
  willingness_to_pay integer CHECK (willingness_to_pay >= 1 AND willingness_to_pay <= 10),
  categories text[],
  votes integer NOT NULL DEFAULT 1,
  status character varying NOT NULL DEFAULT 'submitted'::character varying CHECK (status::text = ANY (ARRAY['submitted'::character varying, 'under_review'::character varying, 'planned'::character varying, 'in_development'::character varying, 'completed'::character varying, 'rejected'::character varying]::text[])),
  admin_priority character varying CHECK (admin_priority::text = ANY (ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying]::text[])),
  estimated_effort character varying CHECK (estimated_effort::text = ANY (ARRAY['small'::character varying, 'medium'::character varying, 'large'::character varying, 'xlarge'::character varying]::text[])),
  target_release character varying,
  admin_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feature_requests_pkey PRIMARY KEY (id),
  CONSTRAINT feature_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Feature votes table
CREATE TABLE IF NOT EXISTS public.feature_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature_request_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feature_votes_pkey PRIMARY KEY (id),
  CONSTRAINT feature_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT feature_votes_feature_request_id_fkey FOREIGN KEY (feature_request_id) REFERENCES public.feature_requests(id) ON DELETE CASCADE,
  CONSTRAINT feature_votes_user_feature_unique UNIQUE (user_id, feature_request_id)
);

-- Usage events table
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature character varying NOT NULL,
  metadata jsonb,
  satisfaction integer CHECK (satisfaction >= 1 AND satisfaction <= 5),
  session_id character varying,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT usage_events_pkey PRIMARY KEY (id),
  CONSTRAINT usage_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- User onboarding table
CREATE TABLE IF NOT EXISTS public.user_onboarding (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  current_step text NOT NULL DEFAULT 'welcome'::text CHECK (current_step = ANY (ARRAY['welcome'::text, 'user_type'::text, 'first_analysis'::text, 'features_tour'::text, 'preferences'::text, 'completed'::text])),
  completed_steps text[] DEFAULT ARRAY[]::text[],
  user_type text CHECK (user_type IS NULL OR (user_type = ANY (ARRAY['content_creator'::text, 'business_owner'::text, 'marketer'::text, 'hobbyist'::text, 'agency'::text]))),
  content_categories text[] CHECK (content_categories IS NULL OR content_categories <@ ARRAY['educational'::text, 'entertainment'::text, 'gaming'::text, 'lifestyle'::text, 'business'::text, 'technology'::text, 'health_fitness'::text, 'travel'::text, 'other'::text]),
  monthly_video_count integer CHECK (monthly_video_count IS NULL OR monthly_video_count >= 0),
  channel_name text,
  first_analysis_completed boolean DEFAULT false,
  first_analysis_rating integer CHECK (first_analysis_rating >= 1 AND first_analysis_rating <= 5),
  preferences jsonb DEFAULT '{}'::jsonb,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_onboarding_pkey PRIMARY KEY (id),
  CONSTRAINT user_onboarding_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS user_feedbacks_user_id_idx ON public.user_feedbacks(user_id);
CREATE INDEX IF NOT EXISTS user_feedbacks_type_idx ON public.user_feedbacks(type);
CREATE INDEX IF NOT EXISTS user_feedbacks_status_idx ON public.user_feedbacks(status);
CREATE INDEX IF NOT EXISTS user_feedbacks_created_at_idx ON public.user_feedbacks(created_at);

CREATE INDEX IF NOT EXISTS feature_requests_user_id_idx ON public.feature_requests(user_id);
CREATE INDEX IF NOT EXISTS feature_requests_status_idx ON public.feature_requests(status);
CREATE INDEX IF NOT EXISTS feature_requests_votes_idx ON public.feature_requests(votes);
CREATE INDEX IF NOT EXISTS feature_requests_created_at_idx ON public.feature_requests(created_at);

CREATE INDEX IF NOT EXISTS feature_votes_user_id_idx ON public.feature_votes(user_id);
CREATE INDEX IF NOT EXISTS feature_votes_feature_request_id_idx ON public.feature_votes(feature_request_id);

CREATE INDEX IF NOT EXISTS usage_events_user_id_idx ON public.usage_events(user_id);
CREATE INDEX IF NOT EXISTS usage_events_feature_idx ON public.usage_events(feature);
CREATE INDEX IF NOT EXISTS usage_events_created_at_idx ON public.usage_events(created_at);

CREATE INDEX IF NOT EXISTS user_onboarding_user_id_idx ON public.user_onboarding(user_id);
CREATE INDEX IF NOT EXISTS user_onboarding_current_step_idx ON public.user_onboarding(current_step);

-- Enable RLS
ALTER TABLE public.user_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own feedback" ON public.user_feedbacks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create feedback" ON public.user_feedbacks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view all feature requests" ON public.feature_requests
  FOR SELECT USING (true);

CREATE POLICY "Users can create feature requests" ON public.feature_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can vote on features" ON public.feature_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own usage events" ON public.usage_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own onboarding" ON public.user_onboarding
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding" ON public.user_onboarding
  FOR UPDATE USING (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE public.user_feedbacks IS 'User feedback and bug reports';
COMMENT ON TABLE public.feature_requests IS 'Feature requests with voting and prioritization';
COMMENT ON TABLE public.feature_votes IS 'User votes on feature requests';
COMMENT ON TABLE public.usage_events IS 'Feature usage tracking for analytics';
COMMENT ON TABLE public.user_onboarding IS 'User onboarding progress and preferences';
