
DO $$ BEGIN
  CREATE TYPE public.library_category AS ENUM ('generation_prompt','script_template','hook_formula','shot_recipe','vo_style');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.prompt_library
  ADD COLUMN IF NOT EXISTS category public.library_category NOT NULL DEFAULT 'generation_prompt',
  ADD COLUMN IF NOT EXISTS entry_point text,
  ADD COLUMN IF NOT EXISTS source_brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_metric text,
  ADD COLUMN IF NOT EXISTS times_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS prompt_library_category_idx ON public.prompt_library(category);
CREATE INDEX IF NOT EXISTS prompt_library_favorite_idx ON public.prompt_library(is_favorite) WHERE is_favorite;
