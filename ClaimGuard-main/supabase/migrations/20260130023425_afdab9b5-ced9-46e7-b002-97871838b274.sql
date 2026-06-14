-- Create storage bucket for claim documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('claim-documents', 'claim-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create policies for claim documents bucket
CREATE POLICY "Authenticated users can upload claim documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'claim-documents');

CREATE POLICY "Users can view claim documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'claim-documents');

CREATE POLICY "Users can delete their uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'claim-documents');

-- Create claim_documents table to track uploads
CREATE TABLE public.claim_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.claim_documents ENABLE ROW LEVEL SECURITY;

-- Policies for claim documents table
CREATE POLICY "Authenticated users can view claim documents"
ON public.claim_documents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can upload documents"
ON public.claim_documents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own uploads"
ON public.claim_documents FOR DELETE
TO authenticated
USING (auth.uid() = uploaded_by);