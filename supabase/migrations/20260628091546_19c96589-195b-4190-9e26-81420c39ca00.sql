
DO $$ BEGIN
  CREATE TYPE public.metric_action AS ENUM ('none','scale','iterate_hook','iterate_body','iterate_offer','kill');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.metrics
  ADD COLUMN IF NOT EXISTS test_cell_id uuid REFERENCES public.test_cells(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS three_sec_views integer,
  ADD COLUMN IF NOT EXISTS thumbstop_rate numeric,
  ADD COLUMN IF NOT EXISTS reach integer,
  ADD COLUMN IF NOT EXISTS clicks integer,
  ADD COLUMN IF NOT EXISTS conversions integer,
  ADD COLUMN IF NOT EXISTS diagnosis text,
  ADD COLUMN IF NOT EXISTS action_taken public.metric_action NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS metrics_test_cell_idx ON public.metrics(test_cell_id);
CREATE INDEX IF NOT EXISTS metrics_date_idx ON public.metrics(test_cell_id, date DESC);
