
-- Drop the existing permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view claims" ON public.claims;

-- Admin: can see all claims
CREATE POLICY "Admins can view all claims"
ON public.claims FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::user_role));

-- SIU analysts: can only see high-risk claims
CREATE POLICY "SIU analysts can view high-risk claims"
ON public.claims FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'siu_analyst'::user_role)
  AND risk_category = 'high'
);

-- Adjusters: can see claims assigned to them or created by them
CREATE POLICY "Adjusters can view assigned or own claims"
ON public.claims FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'adjuster'::user_role)
  AND (assigned_to = auth.uid() OR created_by = auth.uid())
);
