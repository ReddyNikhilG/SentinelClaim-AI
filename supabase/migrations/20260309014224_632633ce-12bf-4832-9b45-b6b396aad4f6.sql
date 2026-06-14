
-- Allow admins to read all notification preferences (for admin panel)
CREATE POLICY "Admins can view all notification preferences"
  ON public.notification_preferences
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Allow admins to update any user's notification preferences
CREATE POLICY "Admins can update any notification preferences"
  ON public.notification_preferences
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Allow admins to insert preferences for any user
CREATE POLICY "Admins can insert notification preferences for any user"
  ON public.notification_preferences
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));
