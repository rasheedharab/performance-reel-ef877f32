DO $$ BEGIN
  CREATE TYPE public.shot_generation_method AS ENUM ('text-to-video','image-to-video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.shots
  ADD COLUMN IF NOT EXISTS generation_method public.shot_generation_method NOT NULL DEFAULT 'text-to-video',
  ADD COLUMN IF NOT EXISTS reference_image_url text,
  ADD COLUMN IF NOT EXISTS tool_reason text,
  ADD COLUMN IF NOT EXISTS caption_text text;