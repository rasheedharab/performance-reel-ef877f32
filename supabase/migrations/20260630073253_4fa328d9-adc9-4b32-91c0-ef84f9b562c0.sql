
ALTER TABLE public.shots ADD COLUMN IF NOT EXISTS needs_generated_anchor boolean NOT NULL DEFAULT false;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS frame_id uuid REFERENCES public.frames(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS assets_frame_id_idx ON public.assets(frame_id);
