
CREATE TABLE public.sla_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_attempt_rate_target integer NOT NULL DEFAULT 80,
  max_hourly_failure_rate integer NOT NULL DEFAULT 20,
  failure_alert_min_samples integer NOT NULL DEFAULT 5,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.sla_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view SLA thresholds" ON public.sla_thresholds
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update SLA thresholds" ON public.sla_thresholds
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert SLA thresholds" ON public.sla_thresholds
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone authenticated can read for edge functions" ON public.sla_thresholds
  FOR SELECT TO authenticated
  USING (true);

-- Insert default row
INSERT INTO public.sla_thresholds (first_attempt_rate_target, max_hourly_failure_rate, failure_alert_min_samples) VALUES (80, 20, 5);
