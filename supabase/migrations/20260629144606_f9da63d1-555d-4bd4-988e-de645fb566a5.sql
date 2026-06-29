ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS negative_used text,
  ADD COLUMN IF NOT EXISTS seed_used integer,
  ADD COLUMN IF NOT EXISTS audio_used text;