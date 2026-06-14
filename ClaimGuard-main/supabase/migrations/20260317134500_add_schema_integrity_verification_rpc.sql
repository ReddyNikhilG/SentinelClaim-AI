-- Adds a runtime verification RPC for key foreign keys and policies.

CREATE OR REPLACE FUNCTION public.verify_schema_integrity()
RETURNS TABLE(check_name text, ok boolean, details text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    'fk_notification_preferences_user_id'::text,
    EXISTS(
      SELECT 1 FROM pg_constraint
      WHERE conname = 'notification_preferences_user_id_fkey'
    ) AS ok,
    'notification_preferences.user_id -> auth.users(id)'::text

  UNION ALL

  SELECT
    'fk_email_log_user_id'::text,
    EXISTS(
      SELECT 1 FROM pg_constraint
      WHERE conname = 'email_log_user_id_fkey'
    ) AS ok,
    'email_log.user_id -> auth.users(id)'::text

  UNION ALL

  SELECT
    'fk_chat_messages_user_id'::text,
    EXISTS(
      SELECT 1 FROM pg_constraint
      WHERE conname = 'chat_messages_user_id_fkey'
    ) AS ok,
    'chat_messages.user_id -> auth.users(id)'::text

  UNION ALL

  SELECT
    'policy_claims_created_by_fallback'::text,
    EXISTS(
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'claims'
        AND policyname = 'Users can view own created claims fallback'
    ) AS ok,
    'RLS fallback policy exists on claims'::text;
$$;

GRANT EXECUTE ON FUNCTION public.verify_schema_integrity() TO authenticated;
