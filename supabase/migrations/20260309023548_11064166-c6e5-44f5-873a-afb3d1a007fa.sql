
-- Email delivery audit log
CREATE TABLE public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  subject text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Users can see their own email log
CREATE POLICY "Users can view own email log" ON public.email_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Admins can view all
CREATE POLICY "Admins can view all email log" ON public.email_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
-- System can insert
CREATE POLICY "System can insert email log" ON public.email_log FOR INSERT WITH CHECK (true);
