-- Frames table: AI-generated still images for image-to-video anchor frames and brand visuals.
CREATE TYPE public.frame_purpose AS ENUM ('anchor_frame','hero_shot','establishing','character','style_ref');
CREATE TYPE public.frame_status AS ENUM ('queued','generating','review','approved','rejected');

CREATE TABLE public.frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shot_id uuid REFERENCES public.shots(id) ON DELETE SET NULL,
  brief_id uuid REFERENCES public.briefs(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  purpose public.frame_purpose NOT NULL DEFAULT 'anchor_frame',
  image_prompt text,
  negative_prompt text,
  model_id text,
  aspect_ratio text DEFAULT '9:16',
  seed integer,
  reference_image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_url text,
  job_id text,
  status public.frame_status NOT NULL DEFAULT 'queued',
  version integer NOT NULL DEFAULT 1,
  is_selected boolean NOT NULL DEFAULT false,
  cost_estimate numeric(10,4),
  actual_cost numeric(10,4),
  cost_source text,
  usage_meta jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX frames_user_idx ON public.frames(user_id);
CREATE INDEX frames_shot_idx ON public.frames(shot_id);
CREATE INDEX frames_brief_idx ON public.frames(brief_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.frames TO authenticated;
GRANT ALL ON public.frames TO service_role;

ALTER TABLE public.frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own frames" ON public.frames
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER frames_updated BEFORE UPDATE ON public.frames
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Image model tier config: shared lookup, read-only to authenticated users.
CREATE TABLE public.image_model_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  draft_model_id text,
  draft_cost numeric(10,4),
  final_model_id text NOT NULL,
  final_cost numeric(10,4),
  supports_reference boolean NOT NULL DEFAULT false,
  supports_text_in_image boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.image_model_tiers TO authenticated;
GRANT ALL ON public.image_model_tiers TO service_role;

ALTER TABLE public.image_model_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "image tiers readable by authenticated" ON public.image_model_tiers
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER image_model_tiers_updated BEFORE UPDATE ON public.image_model_tiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default tiers. Slugs are placeholders matching the user's request — confirm against fal.ai docs.
INSERT INTO public.image_model_tiers
  (job_type, label, description, draft_model_id, draft_cost, final_model_id, final_cost, supports_reference, supports_text_in_image, sort_order)
VALUES
  ('product_hero', 'Product / Hero (accuracy)',
   'Crisp product and hero shots where fidelity matters. Photographic, not stylized.',
   'fal-ai/flux-2/flash', 0.01, 'fal-ai/flux-2/pro', 0.05, true, false, 10),
  ('product_with_text', 'Product / Packaging with text',
   'Use when on-pack copy, labels, or in-image text must render correctly.',
   'fal-ai/ideogram/v3', 0.04, 'fal-ai/ideogram/v3', 0.04, true, true, 20),
  ('lifestyle_scene', 'Lifestyle / Scene (volume)',
   'High-volume lifestyle and scene generation. Draft to explore, final for hero pick.',
   'fal-ai/bytedance/seedream/v4.5-lite', 0.01, 'fal-ai/bytedance/seedream/v4.5', 0.03, true, false, 30),
  ('photoreal_people', 'Photoreal people / faces',
   'Realistic human subjects and faces. Skin, eyes, hands rendered cleanly.',
   'fal-ai/imagen4/preview', 0.04, 'fal-ai/imagen4/preview', 0.04, true, false, 40),
  ('image_edit', 'Edit existing image',
   'Restyle background, fix a detail, or extend an existing frame.',
   'fal-ai/flux-pro/kontext', 0.04, 'fal-ai/bytedance/seedream/v4.5/edit', 0.04, true, false, 50);
