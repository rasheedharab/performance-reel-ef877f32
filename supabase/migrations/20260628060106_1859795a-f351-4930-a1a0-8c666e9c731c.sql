
ALTER TABLE public.briefs
  ADD COLUMN IF NOT EXISTS product_asset_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ugc_asset_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS regulatory_notes text;

-- Storage policies for campaign-assets bucket (bucket created via tool).
CREATE POLICY "Users read own campaign-assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'campaign-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own campaign-assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own campaign-assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'campaign-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own campaign-assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
