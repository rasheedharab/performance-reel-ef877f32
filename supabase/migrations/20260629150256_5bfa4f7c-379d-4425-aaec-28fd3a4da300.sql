DO $$ BEGIN
  CREATE TYPE public.render_tier AS ENUM ('draft', 'final');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS render_tier public.render_tier NOT NULL DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS assets_render_tier_idx ON public.assets (render_tier);