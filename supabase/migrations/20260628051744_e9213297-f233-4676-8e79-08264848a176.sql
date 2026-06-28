
CREATE TYPE brief_status AS ENUM ('draft','locked','in_production','live','archived');
CREATE TYPE brief_objective AS ENUM ('awareness','traffic','engagement','leads','sales');
CREATE TYPE angle_entry_point AS ENUM ('pain','outcome','objection','social_proof','identity','curiosity');
CREATE TYPE asset_type AS ENUM ('clip','voiceover','music','sfx');
CREATE TYPE asset_status AS ENUM ('queued','generating','review','approved','rejected');
CREATE TYPE deliverable_placement AS ENUM ('reels','feed','stories');
CREATE TYPE deliverable_aspect AS ENUM ('9:16','4:5','1:1');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, website TEXT, category TEXT, one_line_what_you_sell TEXT,
  years_in_business INT, brand_voice TEXT, tone_do TEXT, tone_dont TEXT,
  personality JSONB DEFAULT '{}'::jsonb, primary_color TEXT, secondary_color TEXT,
  fonts TEXT, avoid_competitors TEXT, no_go_list TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own brands" ON public.brands FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER brands_updated BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL, status brief_status NOT NULL DEFAULT 'draft',
  deadline DATE, signoff_owner TEXT, product_name TEXT, price NUMERIC,
  product_description TEXT, benefits JSONB DEFAULT '[]'::jsonb, wedge TEXT,
  offer_type TEXT, offer_detail TEXT, objective brief_objective,
  awareness_stage TEXT, kpi_type TEXT, kpi_target TEXT, benchmark TEXT,
  destination_url TEXT, budget_tier TEXT, audience_age TEXT, audience_gender TEXT,
  audience_location TEXT, audience_income TEXT, psychographic TEXT,
  core_driver TEXT, objection TEXT, headspace TEXT, customer_language TEXT,
  testimonials TEXT, stats_claims TEXT, claims_substantiated BOOLEAN DEFAULT false,
  awards TEXT, must_include TEXT, regulated BOOLEAN DEFAULT false, disclosures TEXT,
  cannot_claim TEXT, legal_copy TEXT, likeness_notes TEXT,
  ai_disclosure BOOLEAN DEFAULT false, captions_required BOOLEAN DEFAULT true,
  archetypes JSONB DEFAULT '[]'::jsonb, placements JSONB DEFAULT '[]'::jsonb,
  variants_needed INT DEFAULT 1, languages TEXT, reference_links TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefs TO authenticated;
GRANT ALL ON public.briefs TO service_role;
ALTER TABLE public.briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own briefs" ON public.briefs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER briefs_updated BEFORE UPDATE ON public.briefs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX briefs_status_idx ON public.briefs(user_id, status);

CREATE TABLE public.angles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_id UUID NOT NULL REFERENCES public.briefs(id) ON DELETE CASCADE,
  title TEXT NOT NULL, entry_point angle_entry_point, target_segment TEXT,
  description TEXT, status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.angles TO authenticated;
GRANT ALL ON public.angles TO service_role;
ALTER TABLE public.angles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own angles" ON public.angles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER angles_updated BEFORE UPDATE ON public.angles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  angle_id UUID NOT NULL REFERENCES public.angles(id) ON DELETE CASCADE,
  archetype TEXT, hook TEXT, body TEXT, proof_beat TEXT, cta TEXT,
  full_script TEXT, duration_seconds INT, status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scripts TO authenticated;
GRANT ALL ON public.scripts TO service_role;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scripts" ON public.scripts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER scripts_updated BEFORE UPDATE ON public.scripts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  shot_number INT, visual_description TEXT, camera_move TEXT, motion_intensity TEXT,
  duration_seconds NUMERIC, audio_note TEXT, assigned_tool TEXT, reference_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shots TO authenticated;
GRANT ALL ON public.shots TO service_role;
ALTER TABLE public.shots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own shots" ON public.shots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER shots_updated BEFORE UPDATE ON public.shots FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shot_id UUID NOT NULL REFERENCES public.shots(id) ON DELETE CASCADE,
  type asset_type NOT NULL, tool_used TEXT, prompt_used TEXT, version INT DEFAULT 1,
  status asset_status NOT NULL DEFAULT 'queued', file_url TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own assets" ON public.assets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER assets_updated BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_id UUID NOT NULL REFERENCES public.briefs(id) ON DELETE CASCADE,
  name TEXT NOT NULL, version INT DEFAULT 1, status TEXT DEFAULT 'draft', edit_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cuts TO authenticated;
GRANT ALL ON public.cuts TO service_role;
ALTER TABLE public.cuts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cuts" ON public.cuts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER cuts_updated BEFORE UPDATE ON public.cuts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cut_id UUID NOT NULL REFERENCES public.cuts(id) ON DELETE CASCADE,
  placement deliverable_placement, aspect_ratio deliverable_aspect,
  duration_seconds NUMERIC, captions_burned BOOLEAN DEFAULT false,
  spec_checked BOOLEAN DEFAULT false, file_url TEXT, status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliverables TO authenticated;
GRANT ALL ON public.deliverables TO service_role;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own deliverables" ON public.deliverables FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER deliverables_updated BEFORE UPDATE ON public.deliverables FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deliverable_id UUID NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  date DATE NOT NULL, spend NUMERIC, impressions BIGINT, hook_rate NUMERIC,
  hold_rate NUMERIC, ctr NUMERIC, cpa NUMERIC, roas NUMERIC, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metrics TO authenticated;
GRANT ALL ON public.metrics TO service_role;
ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own metrics" ON public.metrics FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER metrics_updated BEFORE UPDATE ON public.metrics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.qa_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_id UUID NOT NULL REFERENCES public.briefs(id) ON DELETE CASCADE,
  claims_ok BOOLEAN DEFAULT false, disclosures_ok BOOLEAN DEFAULT false,
  brand_ok BOOLEAN DEFAULT false, safe_zones_ok BOOLEAN DEFAULT false,
  captions_ok BOOLEAN DEFAULT false, specs_ok BOOLEAN DEFAULT false,
  policy_ok BOOLEAN DEFAULT false, reviewer TEXT, signed_off BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_reviews TO authenticated;
GRANT ALL ON public.qa_reviews TO service_role;
ALTER TABLE public.qa_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own qa_reviews" ON public.qa_reviews FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER qa_reviews_updated BEFORE UPDATE ON public.qa_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_id UUID NOT NULL REFERENCES public.briefs(id) ON DELETE CASCADE,
  meta_campaign_name TEXT, objective TEXT, structure_type TEXT,
  test_matrix JSONB DEFAULT '{}'::jsonb, naming_convention TEXT, status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own campaigns" ON public.campaigns FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER campaigns_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.prompt_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, archetype TEXT, tool TEXT, prompt_text TEXT,
  notes TEXT, performance_tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_library TO authenticated;
GRANT ALL ON public.prompt_library TO service_role;
ALTER TABLE public.prompt_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prompts" ON public.prompt_library FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER prompt_library_updated BEFORE UPDATE ON public.prompt_library FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
