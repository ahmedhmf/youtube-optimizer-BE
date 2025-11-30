-- Subscription and billing tables
-- Manages user subscriptions, payment methods, billing history, and promotional codes

-- Create custom types
DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'premium');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'incomplete', 'trialing');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE billing_interval AS ENUM ('monthly', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- User subscriptions table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  tier subscription_tier NOT NULL DEFAULT 'free'::subscription_tier,
  status subscription_status NOT NULL DEFAULT 'active'::subscription_status,
  billing_interval billing_interval NOT NULL DEFAULT 'monthly'::billing_interval,
  current_period_start timestamp with time zone NOT NULL DEFAULT now(),
  current_period_end timestamp with time zone NOT NULL,
  auto_renew boolean NOT NULL DEFAULT true,
  amount integer NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'USD'::text CHECK (currency = ANY (ARRAY['USD'::text, 'EUR'::text, 'GBP'::text])),
  stripe_subscription_id text,
  stripe_customer_id text,
  trial_end timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Subscription limits table
CREATE TABLE IF NOT EXISTS public.subscription_limits (
  tier character varying NOT NULL,
  video_analysis_limit integer NOT NULL,
  token_limit integer NOT NULL,
  api_calls_limit integer NOT NULL,
  features jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscription_limits_pkey PRIMARY KEY (tier)
);

-- Payment methods table
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_payment_method_id text NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  card_brand text,
  card_last_four text,
  card_exp_month integer CHECK (card_exp_month >= 1 AND card_exp_month <= 12),
  card_exp_year integer CHECK (card_exp_year::numeric >= EXTRACT(year FROM now())),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_methods_pkey PRIMARY KEY (id),
  CONSTRAINT payment_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Billing history table
CREATE TABLE IF NOT EXISTS public.billing_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_id uuid,
  stripe_invoice_id text,
  amount integer NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'USD'::text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text])),
  billing_date timestamp with time zone NOT NULL,
  paid_at timestamp with time zone,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT billing_history_pkey PRIMARY KEY (id),
  CONSTRAINT billing_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT billing_history_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.user_subscriptions(id) ON DELETE SET NULL
);

-- Promo codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_percentage integer CHECK (discount_percentage IS NULL OR discount_percentage > 0 AND discount_percentage <= 100),
  discount_amount integer CHECK (discount_amount IS NULL OR discount_amount > 0),
  valid_from timestamp with time zone NOT NULL DEFAULT now(),
  valid_until timestamp with time zone,
  max_uses integer,
  current_uses integer NOT NULL DEFAULT 0,
  applicable_tiers text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT promo_codes_pkey PRIMARY KEY (id)
);

-- Promo code usage table
CREATE TABLE IF NOT EXISTS public.promo_code_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL,
  user_id uuid NOT NULL,
  subscription_id uuid,
  used_at timestamp with time zone DEFAULT now(),
  CONSTRAINT promo_code_usage_pkey PRIMARY KEY (id),
  CONSTRAINT promo_code_usage_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  CONSTRAINT promo_code_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT promo_code_usage_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.user_subscriptions(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_idx ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_tier_idx ON public.user_subscriptions(tier);
CREATE INDEX IF NOT EXISTS user_subscriptions_status_idx ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS user_subscriptions_stripe_customer_id_idx ON public.user_subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS payment_methods_user_id_idx ON public.payment_methods(user_id);
CREATE INDEX IF NOT EXISTS payment_methods_is_default_idx ON public.payment_methods(user_id, is_default);

CREATE INDEX IF NOT EXISTS billing_history_user_id_idx ON public.billing_history(user_id);
CREATE INDEX IF NOT EXISTS billing_history_subscription_id_idx ON public.billing_history(subscription_id);
CREATE INDEX IF NOT EXISTS billing_history_billing_date_idx ON public.billing_history(billing_date);
CREATE INDEX IF NOT EXISTS billing_history_status_idx ON public.billing_history(status);

CREATE INDEX IF NOT EXISTS promo_codes_code_idx ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS promo_codes_is_active_idx ON public.promo_codes(is_active);

CREATE INDEX IF NOT EXISTS promo_code_usage_user_id_idx ON public.promo_code_usage(user_id);
CREATE INDEX IF NOT EXISTS promo_code_usage_promo_code_id_idx ON public.promo_code_usage(promo_code_id);

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own subscription" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own payment methods" ON public.payment_methods
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own billing history" ON public.billing_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view active promo codes" ON public.promo_codes
  FOR SELECT USING (is_active = true);

-- Insert default subscription limits
INSERT INTO public.subscription_limits (tier, video_analysis_limit, token_limit, api_calls_limit, features)
VALUES 
  ('free', 5, 10000, 100, '{"ai_suggestions": false, "bulk_analysis": false}'::jsonb),
  ('pro', 50, 100000, 1000, '{"ai_suggestions": true, "bulk_analysis": false}'::jsonb),
  ('premium', -1, -1, -1, '{"ai_suggestions": true, "bulk_analysis": true}'::jsonb)
ON CONFLICT (tier) DO NOTHING;

-- Add comments
COMMENT ON TABLE public.user_subscriptions IS 'User subscription tiers and billing information';
COMMENT ON TABLE public.subscription_limits IS 'Limits and features for each subscription tier';
COMMENT ON TABLE public.payment_methods IS 'User payment methods for subscriptions';
COMMENT ON TABLE public.billing_history IS 'Historical billing transactions';
COMMENT ON TABLE public.promo_codes IS 'Promotional discount codes';
COMMENT ON TABLE public.promo_code_usage IS 'Tracks promo code usage by users';
