-- Logging and monitoring tables
-- Tables for comprehensive application logging and monitoring

-- User logs table
CREATE TABLE IF NOT EXISTS public.user_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  log_type character varying NOT NULL,
  activity_type character varying NOT NULL,
  description text NOT NULL,
  severity character varying NOT NULL DEFAULT 'info'::character varying,
  ip_address inet,
  user_agent text,
  device_id character varying,
  session_id uuid,
  request_id character varying,
  metadata jsonb DEFAULT '{}'::jsonb,
  stack_trace text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  resolved_by uuid,
  CONSTRAINT user_logs_pkey PRIMARY KEY (id),
  CONSTRAINT user_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT user_logs_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Error logs table
CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  error_code character varying,
  error_type character varying NOT NULL,
  message text NOT NULL,
  severity character varying NOT NULL DEFAULT 'error'::character varying,
  stack_trace text,
  context jsonb DEFAULT '{}'::jsonb,
  user_id uuid,
  endpoint character varying,
  method character varying,
  status_code integer,
  ip_address inet,
  user_agent text,
  request_id character varying,
  resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  resolution_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  occurrences integer DEFAULT 1,
  first_occurred_at timestamp with time zone DEFAULT now(),
  last_occurred_at timestamp with time zone DEFAULT now(),
  CONSTRAINT error_logs_pkey PRIMARY KEY (id),
  CONSTRAINT error_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT error_logs_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- System logs table
CREATE TABLE IF NOT EXISTS public.system_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  log_level character varying NOT NULL,
  category character varying NOT NULL,
  service_name character varying NOT NULL,
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  stack_trace text,
  hostname character varying,
  process_id integer,
  memory_usage_mb integer,
  cpu_usage_percent numeric,
  related_entity_type character varying,
  related_entity_id character varying,
  request_id character varying,
  resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT system_logs_pkey PRIMARY KEY (id)
);

-- API request logs table
CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  request_id character varying NOT NULL UNIQUE,
  user_id uuid,
  endpoint character varying NOT NULL,
  method character varying NOT NULL,
  status_code integer NOT NULL,
  response_time_ms integer NOT NULL,
  request_size_bytes integer,
  response_size_bytes integer,
  ip_address inet,
  user_agent text,
  referrer text,
  query_params jsonb DEFAULT '{}'::jsonb,
  request_body jsonb,
  response_body jsonb,
  headers jsonb DEFAULT '{}'::jsonb,
  error_message text,
  rate_limit_hit boolean DEFAULT false,
  cached boolean DEFAULT false,
  session_id uuid,
  device_id character varying,
  geographical_location jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT api_request_logs_pkey PRIMARY KEY (id),
  CONSTRAINT api_request_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS user_logs_user_id_idx ON public.user_logs(user_id);
CREATE INDEX IF NOT EXISTS user_logs_activity_type_idx ON public.user_logs(activity_type);
CREATE INDEX IF NOT EXISTS user_logs_severity_idx ON public.user_logs(severity);
CREATE INDEX IF NOT EXISTS user_logs_created_at_idx ON public.user_logs(created_at);

CREATE INDEX IF NOT EXISTS error_logs_user_id_idx ON public.error_logs(user_id);
CREATE INDEX IF NOT EXISTS error_logs_error_type_idx ON public.error_logs(error_type);
CREATE INDEX IF NOT EXISTS error_logs_severity_idx ON public.error_logs(severity);
CREATE INDEX IF NOT EXISTS error_logs_resolved_idx ON public.error_logs(resolved);
CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON public.error_logs(created_at);

CREATE INDEX IF NOT EXISTS system_logs_category_idx ON public.system_logs(category);
CREATE INDEX IF NOT EXISTS system_logs_log_level_idx ON public.system_logs(log_level);
CREATE INDEX IF NOT EXISTS system_logs_created_at_idx ON public.system_logs(created_at);

CREATE INDEX IF NOT EXISTS api_request_logs_user_id_idx ON public.api_request_logs(user_id);
CREATE INDEX IF NOT EXISTS api_request_logs_endpoint_idx ON public.api_request_logs(endpoint);
CREATE INDEX IF NOT EXISTS api_request_logs_status_code_idx ON public.api_request_logs(status_code);
CREATE INDEX IF NOT EXISTS api_request_logs_created_at_idx ON public.api_request_logs(created_at);
CREATE INDEX IF NOT EXISTS api_request_logs_request_id_idx ON public.api_request_logs(request_id);

-- Enable RLS
ALTER TABLE public.user_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (restrictive - mainly for service role and admins)
CREATE POLICY "Service role can manage user logs" ON public.user_logs FOR ALL USING (true);
CREATE POLICY "Service role can manage error logs" ON public.error_logs FOR ALL USING (true);
CREATE POLICY "Service role can manage system logs" ON public.system_logs FOR ALL USING (true);
CREATE POLICY "Service role can manage api request logs" ON public.api_request_logs FOR ALL USING (true);

-- Add comments
COMMENT ON TABLE public.user_logs IS 'User activity logs for authentication, profile changes, and business events';
COMMENT ON TABLE public.error_logs IS 'Application errors for debugging and monitoring';
COMMENT ON TABLE public.system_logs IS 'System-level events for infrastructure monitoring';
COMMENT ON TABLE public.api_request_logs IS 'API request logs for performance and usage tracking';
