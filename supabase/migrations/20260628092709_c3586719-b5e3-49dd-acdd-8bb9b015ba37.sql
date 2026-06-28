ALTER TABLE public.qa_reviews
  ADD COLUMN IF NOT EXISTS claims_substantiated_ok boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS likeness_ok boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_disclosure_ok boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS legal_copy_ok boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT '{}'::jsonb;