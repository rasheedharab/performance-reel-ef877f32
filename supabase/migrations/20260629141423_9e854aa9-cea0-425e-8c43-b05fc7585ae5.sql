
-- STYLE BIBLES ---------------------------------------------------------------
CREATE TABLE public.style_bibles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL UNIQUE REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  film_look text,
  color_grade text,
  lighting_signature text,
  lens_feel text,
  motion_feel text,
  subject_tokens text,
  default_negative text,
  locked_seed integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.style_bibles TO authenticated;
GRANT ALL ON public.style_bibles TO service_role;

ALTER TABLE public.style_bibles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own style bibles"
  ON public.style_bibles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_style_bibles_updated_at
  BEFORE UPDATE ON public.style_bibles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SHOTS: PROMPT SLOTS --------------------------------------------------------
ALTER TABLE public.shots
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS subject_tokens text,
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS setting text,
  ADD COLUMN IF NOT EXISTS lighting text,
  ADD COLUMN IF NOT EXISTS lens text,
  ADD COLUMN IF NOT EXISTS style_grade text,
  ADD COLUMN IF NOT EXISTS mood text,
  ADD COLUMN IF NOT EXISTS dialogue text,
  ADD COLUMN IF NOT EXISTS sfx text,
  ADD COLUMN IF NOT EXISTS ambient text,
  ADD COLUMN IF NOT EXISTS negative_prompt text,
  ADD COLUMN IF NOT EXISTS seed integer,
  ADD COLUMN IF NOT EXISTS prompt_word_target integer NOT NULL DEFAULT 60;
