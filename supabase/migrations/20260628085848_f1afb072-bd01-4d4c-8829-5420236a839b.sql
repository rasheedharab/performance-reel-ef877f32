
-- Extend cuts
ALTER TABLE public.cuts
  ADD COLUMN IF NOT EXISTS script_id uuid REFERENCES public.scripts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_duration numeric,
  ADD COLUMN IF NOT EXISTS music_asset_url text,
  ADD COLUMN IF NOT EXISTS vo_asset_url text,
  ADD COLUMN IF NOT EXISTS hook_timing_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS captions_added boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cta_added boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS brand_frames_ok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS color_consistent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS export_ready boolean NOT NULL DEFAULT false;

-- cut_shots join
CREATE TABLE IF NOT EXISTS public.cut_shots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cut_id uuid NOT NULL REFERENCES public.cuts(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  shot_id uuid REFERENCES public.shots(id) ON DELETE SET NULL,
  sequence_order integer NOT NULL DEFAULT 0,
  transition_note text,
  trim_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cut_shots TO authenticated;
GRANT ALL ON public.cut_shots TO service_role;

ALTER TABLE public.cut_shots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage cut_shots of their own cuts"
  ON public.cut_shots
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cuts c WHERE c.id = cut_shots.cut_id AND c.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.cuts c WHERE c.id = cut_shots.cut_id AND c.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS cut_shots_cut_idx ON public.cut_shots(cut_id, sequence_order);

CREATE TRIGGER cut_shots_set_updated_at
  BEFORE UPDATE ON public.cut_shots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
