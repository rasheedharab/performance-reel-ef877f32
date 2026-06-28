-- Add new beat / sound-off / target_duration columns
ALTER TABLE public.scripts
  ADD COLUMN IF NOT EXISTS desire_beat text,
  ADD COLUMN IF NOT EXISTS works_sound_off boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vo_script text,
  ADD COLUMN IF NOT EXISTS on_screen_text text,
  ADD COLUMN IF NOT EXISTS target_duration integer;

-- Status enum
DO $$ BEGIN
  CREATE TYPE public.script_status AS ENUM ('draft', 'approved', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.scripts
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.script_status USING (
    CASE
      WHEN status IN ('draft','approved','archived') THEN status::public.script_status
      ELSE 'draft'::public.script_status
    END
  ),
  ALTER COLUMN status SET DEFAULT 'draft'::public.script_status,
  ALTER COLUMN status SET NOT NULL;