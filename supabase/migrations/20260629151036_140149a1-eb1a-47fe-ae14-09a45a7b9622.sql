ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS variant_label text,
  ADD COLUMN IF NOT EXISTS ab_group_id uuid;
CREATE INDEX IF NOT EXISTS assets_ab_group_id_idx ON public.assets (ab_group_id);
CREATE INDEX IF NOT EXISTS assets_shot_ab_group_idx ON public.assets (shot_id, ab_group_id);