
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS model_id text,
  ADD COLUMN IF NOT EXISTS job_id text,
  ADD COLUMN IF NOT EXISTS cost_estimate numeric,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS reference_image_url text,
  ADD COLUMN IF NOT EXISTS generation_method text,
  ADD COLUMN IF NOT EXISTS voice_id text,
  ADD COLUMN IF NOT EXISTS source_text text,
  ADD COLUMN IF NOT EXISTS is_selected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS brief_id uuid REFERENCES public.briefs(id) ON DELETE CASCADE;

ALTER TABLE public.assets ALTER COLUMN shot_id DROP NOT NULL;

ALTER TABLE public.assets
  ADD CONSTRAINT assets_shot_or_brief_chk
  CHECK (shot_id IS NOT NULL OR brief_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS assets_shot_id_idx ON public.assets(shot_id);
CREATE INDEX IF NOT EXISTS assets_brief_id_idx ON public.assets(brief_id);
CREATE INDEX IF NOT EXISTS assets_selected_idx ON public.assets(shot_id) WHERE is_selected = true;
