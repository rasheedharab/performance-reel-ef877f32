ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS brand_asset_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
