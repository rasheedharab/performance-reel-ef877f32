
-- Campaign type enum
DO $$ BEGIN
  CREATE TYPE public.campaign_type AS ENUM ('advantage_plus','manual_abo','manual_cbo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.test_cell_status AS ENUM ('planned','live','paused','winner','killed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS campaign_type public.campaign_type,
  ADD COLUMN IF NOT EXISTS daily_budget numeric,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS primary_metric text,
  ADD COLUMN IF NOT EXISTS utm_template text,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS public.test_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  deliverable_id uuid REFERENCES public.deliverables(id) ON DELETE SET NULL,
  angle_id uuid REFERENCES public.angles(id) ON DELETE SET NULL,
  ad_name text,
  hook_label text,
  format_label text,
  utm_url text,
  status public.test_cell_status NOT NULL DEFAULT 'planned',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_cells TO authenticated;
GRANT ALL ON public.test_cells TO service_role;

ALTER TABLE public.test_cells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own test_cells" ON public.test_cells
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS test_cells_campaign_idx ON public.test_cells(campaign_id);

CREATE TRIGGER test_cells_set_updated_at BEFORE UPDATE ON public.test_cells
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
