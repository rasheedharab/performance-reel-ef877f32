ALTER TABLE public.shots
  ADD COLUMN IF NOT EXISTS compiled_prompt text,
  ADD COLUMN IF NOT EXISTS compiled_negative text,
  ADD COLUMN IF NOT EXISTS compiled_audio text,
  ADD COLUMN IF NOT EXISTS compiled_for_tool text,
  ADD COLUMN IF NOT EXISTS compiled_at timestamptz;