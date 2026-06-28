
ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS resolution text,
  ADD COLUMN IF NOT EXISTS safe_zone_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duration_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audio_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS filename text,
  ADD COLUMN IF NOT EXISTS upload_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolution_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text;

-- captions_burned already exists per schema check; ensure default
ALTER TABLE public.deliverables ALTER COLUMN captions_burned SET DEFAULT false;
