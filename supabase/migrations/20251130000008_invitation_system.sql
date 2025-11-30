-- Invitation system for closed beta testing
-- Only users with valid invitation codes can register

CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  email text,
  max_uses integer NOT NULL DEFAULT 1,
  current_uses integer NOT NULL DEFAULT 0,
  created_by uuid,
  expires_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invitations_pkey PRIMARY KEY (id),
  CONSTRAINT invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT invitations_max_uses_check CHECK (max_uses > 0),
  CONSTRAINT invitations_current_uses_check CHECK (current_uses >= 0 AND current_uses <= max_uses)
);

-- Track which user used which invitation
CREATE TABLE IF NOT EXISTS public.invitation_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  used_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invitation_usage_pkey PRIMARY KEY (id),
  CONSTRAINT invitation_usage_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES public.invitations(id) ON DELETE CASCADE,
  CONSTRAINT invitation_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT invitation_usage_unique UNIQUE (invitation_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS invitations_code_idx ON public.invitations(code);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON public.invitations(email);
CREATE INDEX IF NOT EXISTS invitations_created_by_idx ON public.invitations(created_by);
CREATE INDEX IF NOT EXISTS invitations_expires_at_idx ON public.invitations(expires_at);
CREATE INDEX IF NOT EXISTS invitation_usage_invitation_id_idx ON public.invitation_usage(invitation_id);
CREATE INDEX IF NOT EXISTS invitation_usage_user_id_idx ON public.invitation_usage(user_id);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can manage invitations
CREATE POLICY "Admins can view all invitations" ON public.invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create invitations" ON public.invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update invitations" ON public.invitations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role can access invitations" ON public.invitations
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Anyone can view their own invitation usage
CREATE POLICY "Users can view own invitation usage" ON public.invitation_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage invitation usage" ON public.invitation_usage
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Add comments
COMMENT ON TABLE public.invitations IS 'Invitation codes for closed beta registration';
COMMENT ON TABLE public.invitation_usage IS 'Tracks which users used which invitations';
COMMENT ON COLUMN public.invitations.code IS 'Unique invitation code (e.g., BETA-XXXX-XXXX)';
COMMENT ON COLUMN public.invitations.email IS 'Optional: Restrict invitation to specific email';
COMMENT ON COLUMN public.invitations.max_uses IS 'Maximum number of times this code can be used';
COMMENT ON COLUMN public.invitations.current_uses IS 'Current number of uses';
COMMENT ON COLUMN public.invitations.metadata IS 'Additional data (source, campaign, etc.)';
