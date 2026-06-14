
CREATE TABLE public.sla_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  total_emails integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  success_rate integer NOT NULL DEFAULT 0,
  first_attempt_rate integer NOT NULL DEFAULT 0,
  avg_attempts numeric(4,2) NOT NULL DEFAULT 1,
  sla_healthy boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view SLA snapshots" ON public.sla_snapshots
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert SLA snapshots" ON public.sla_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (true);
