
-- Add digest email preferences to notification_preferences
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_digest_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_digest_frequency text NOT NULL DEFAULT 'daily';
