
-- Claim notes/comments table for collaboration
CREATE TABLE public.claim_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'comment' CHECK (note_type IN ('comment', 'internal', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.claim_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for claim_notes
CREATE POLICY "Users can view notes on claims they can see"
  ON public.claim_notes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create notes"
  ON public.claim_notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON public.claim_notes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON public.claim_notes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for claim_notes
ALTER PUBLICATION supabase_realtime ADD TABLE public.claim_notes;
