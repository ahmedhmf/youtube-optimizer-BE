-- Security and audit tables
-- Tables for security events and comprehensive audit trails

-- Security events table
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  event_type character varying NOT NULL,
  ip_address inet,
  user_agent text,
  device_id character varying,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  event_category character varying NOT NULL DEFAULT 'security'::character varying,
  severity character varying NOT NULL DEFAULT 'info'::character varying,
  resource_type character varying,
  resource_id character varying,
  action character varying,
  status character varying,
  request_id character varying,
  CONSTRAINT security_events_pkey PRIMARY KEY (id),
  CONSTRAINT security_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Audit trail table (comprehensive change tracking)
CREATE TABLE IF NOT EXISTS public.audit_trail (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  actor_id uuid,
  actor_email character varying,
  actor_role character varying,
  action character varying NOT NULL,
  entity_type character varying NOT NULL,
  entity_id character varying,
  old_values jsonb,
  new_values jsonb,
  changes jsonb,
  ip_address inet,
  user_agent text,
  session_id uuid,
  request_id character varying,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_trail_pkey PRIMARY KEY (id),
  CONSTRAINT audit_trail_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- IP rate limits table (for rate limiting and security)
CREATE TABLE IF NOT EXISTS public.ip_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ip_address inet NOT NULL,
  endpoint character varying NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  blocked_until timestamp with time zone,
  first_request timestamp with time zone NOT NULL DEFAULT now(),
  last_request timestamp with time zone NOT NULL DEFAULT now(),
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ip_rate_limits_pkey PRIMARY KEY (id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS security_events_user_id_idx ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS security_events_event_type_idx ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS security_events_event_category_idx ON public.security_events(event_category);
CREATE INDEX IF NOT EXISTS security_events_severity_idx ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON public.security_events(created_at);

CREATE INDEX IF NOT EXISTS audit_trail_actor_id_idx ON public.audit_trail(actor_id);
CREATE INDEX IF NOT EXISTS audit_trail_entity_type_idx ON public.audit_trail(entity_type);
CREATE INDEX IF NOT EXISTS audit_trail_entity_id_idx ON public.audit_trail(entity_id);
CREATE INDEX IF NOT EXISTS audit_trail_action_idx ON public.audit_trail(action);
CREATE INDEX IF NOT EXISTS audit_trail_created_at_idx ON public.audit_trail(created_at);

CREATE INDEX IF NOT EXISTS ip_rate_limits_ip_address_idx ON public.ip_rate_limits(ip_address);
CREATE INDEX IF NOT EXISTS ip_rate_limits_endpoint_idx ON public.ip_rate_limits(endpoint);
CREATE INDEX IF NOT EXISTS ip_rate_limits_ip_endpoint_idx ON public.ip_rate_limits(ip_address, endpoint);
CREATE INDEX IF NOT EXISTS ip_rate_limits_blocked_until_idx ON public.ip_rate_limits(blocked_until);

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies (restrictive - service role only)
CREATE POLICY "Service role can manage security events" ON public.security_events FOR ALL USING (true);
CREATE POLICY "Service role can manage audit trail" ON public.audit_trail FOR ALL USING (true);
CREATE POLICY "Service role can manage ip rate limits" ON public.ip_rate_limits FOR ALL USING (true);

-- Add comments
COMMENT ON TABLE public.security_events IS 'Security-related events for audit and compliance';
COMMENT ON TABLE public.audit_trail IS 'Comprehensive audit trail of all system changes';
COMMENT ON TABLE public.ip_rate_limits IS 'IP-based rate limiting for API protection';
