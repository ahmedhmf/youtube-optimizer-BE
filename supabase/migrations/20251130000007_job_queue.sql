-- Background job processing table
-- Queue for asynchronous job processing (email sending, data processing, etc.)

CREATE TABLE IF NOT EXISTS public.job_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_type character varying NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status character varying NOT NULL DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying]::text[])),
  priority integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  retry_count integer NOT NULL DEFAULT 0,
  scheduled_at timestamp with time zone DEFAULT now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  error_message text,
  error_stack text,
  result jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT job_queue_pkey PRIMARY KEY (id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS job_queue_status_idx ON public.job_queue(status);
CREATE INDEX IF NOT EXISTS job_queue_job_type_idx ON public.job_queue(job_type);
CREATE INDEX IF NOT EXISTS job_queue_priority_idx ON public.job_queue(priority);
CREATE INDEX IF NOT EXISTS job_queue_scheduled_at_idx ON public.job_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS job_queue_status_priority_idx ON public.job_queue(status, priority DESC, scheduled_at);

-- Enable RLS
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can access job queue
CREATE POLICY "Service role full access" ON public.job_queue
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Add comment
COMMENT ON TABLE public.job_queue IS 'Background job queue for asynchronous processing';
COMMENT ON COLUMN public.job_queue.priority IS 'Higher priority jobs are processed first (0 = normal, 10 = high)';
COMMENT ON COLUMN public.job_queue.payload IS 'JSON payload with job-specific data';
COMMENT ON COLUMN public.job_queue.result IS 'JSON result data after successful completion';
