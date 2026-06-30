
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS actual_cost numeric;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS cost_source text;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS usage_meta jsonb;

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text,
  task text,
  input_tokens integer,
  output_tokens integer,
  actual_cost numeric,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own ai_usage" ON public.ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own ai_usage" ON public.ai_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
