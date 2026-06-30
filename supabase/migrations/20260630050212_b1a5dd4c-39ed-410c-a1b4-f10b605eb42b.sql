
CREATE TABLE public.shot_prompt_revisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shot_id UUID NOT NULL REFERENCES public.shots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'compile',
  compiled_for_tool TEXT,
  compiled_prompt TEXT,
  compiled_negative TEXT,
  compiled_audio TEXT,
  seed BIGINT,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX shot_prompt_revisions_shot_idx
  ON public.shot_prompt_revisions(shot_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shot_prompt_revisions TO authenticated;
GRANT ALL ON public.shot_prompt_revisions TO service_role;

ALTER TABLE public.shot_prompt_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own shot prompt revisions"
  ON public.shot_prompt_revisions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
