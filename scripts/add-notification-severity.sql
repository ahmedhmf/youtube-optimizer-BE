-- Migration: Add severity column to notifications table
-- Date: 2024
-- Description: Adds severity level (info, success, warning, error) to notifications for visual feedback distinction

-- Step 1: Create enum type for notification severity
DO $$ BEGIN
  CREATE TYPE notification_severity AS ENUM ('info', 'success', 'warning', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Add severity column to notifications table
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS severity notification_severity NOT NULL DEFAULT 'info';

-- Step 3: Create index for filtering by severity (optional but recommended for performance)
CREATE INDEX IF NOT EXISTS idx_notifications_severity ON public.notifications(severity);

-- Step 4: Add comment for documentation
COMMENT ON COLUMN public.notifications.severity IS 'Visual severity level: info (default), success (positive), warning (caution), error (critical)';

-- Verify the changes
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notifications'
  AND column_name = 'severity';
