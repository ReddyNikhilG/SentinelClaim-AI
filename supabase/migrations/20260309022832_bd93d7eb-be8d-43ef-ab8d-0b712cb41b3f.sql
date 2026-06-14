
-- Create role_default_preferences table for admin-managed defaults per role
CREATE TABLE public.role_default_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.user_role NOT NULL UNIQUE,
  email_bulk_approved boolean NOT NULL DEFAULT true,
  email_bulk_rejected boolean NOT NULL DEFAULT true,
  email_bulk_siu_investigation boolean NOT NULL DEFAULT true,
  email_bulk_reassign boolean NOT NULL DEFAULT true,
  email_high_risk_alert boolean NOT NULL DEFAULT true,
  email_claim_reassignment boolean NOT NULL DEFAULT true,
  email_digest_enabled boolean NOT NULL DEFAULT false,
  email_digest_frequency text NOT NULL DEFAULT 'daily',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.role_default_preferences ENABLE ROW LEVEL SECURITY;

-- Only admins can manage role defaults
CREATE POLICY "Admins can view role defaults" ON public.role_default_preferences FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert role defaults" ON public.role_default_preferences FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update role defaults" ON public.role_default_preferences FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Seed defaults for each role
INSERT INTO public.role_default_preferences (role, email_bulk_approved, email_bulk_rejected, email_bulk_siu_investigation, email_bulk_reassign, email_high_risk_alert, email_claim_reassignment, email_digest_enabled, email_digest_frequency)
VALUES
  ('admin', true, true, true, true, true, true, false, 'daily'),
  ('adjuster', true, true, true, true, true, true, false, 'daily'),
  ('siu_analyst', true, true, true, true, true, true, false, 'daily');

-- Update handle_new_user to apply role-based defaults
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _defaults RECORD;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  
  -- Default to adjuster role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'adjuster');
  
  -- Apply role-based notification defaults
  SELECT * INTO _defaults FROM public.role_default_preferences WHERE role = 'adjuster' LIMIT 1;
  
  IF _defaults IS NOT NULL THEN
    INSERT INTO public.notification_preferences (
      user_id, email_bulk_approved, email_bulk_rejected, email_bulk_siu_investigation,
      email_bulk_reassign, email_high_risk_alert, email_claim_reassignment,
      email_digest_enabled, email_digest_frequency
    ) VALUES (
      NEW.id, _defaults.email_bulk_approved, _defaults.email_bulk_rejected,
      _defaults.email_bulk_siu_investigation, _defaults.email_bulk_reassign,
      _defaults.email_high_risk_alert, _defaults.email_claim_reassignment,
      _defaults.email_digest_enabled, _defaults.email_digest_frequency
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
