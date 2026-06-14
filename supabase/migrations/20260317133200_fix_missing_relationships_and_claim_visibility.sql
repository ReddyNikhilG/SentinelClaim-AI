-- Ensure key tables are linked with explicit foreign keys and improve claim visibility fallback.

-- 1) Add missing FK: notification_preferences.user_id -> auth.users(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notification_preferences_user_id_fkey'
  ) THEN
    ALTER TABLE public.notification_preferences
      ADD CONSTRAINT notification_preferences_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- 2) Add missing FK: email_log.user_id -> auth.users(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_log_user_id_fkey'
  ) THEN
    ALTER TABLE public.email_log
      ADD CONSTRAINT email_log_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- 3) Add missing FK: chat_messages.user_id -> auth.users(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chat_messages_user_id_fkey'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- 4) Helpful indexes for FK lookups and retrieval speed
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_email_log_user_id ON public.email_log(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);

-- 5) Claims visibility fallback: user can always view claims they created,
-- even if a role row is missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'claims'
      AND policyname = 'Users can view own created claims fallback'
  ) THEN
    CREATE POLICY "Users can view own created claims fallback"
      ON public.claims
      FOR SELECT
      TO authenticated
      USING (created_by = auth.uid());
  END IF;
END
$$;
