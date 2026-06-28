
-- Create angle_status enum
DO $$ BEGIN
  CREATE TYPE public.angle_status AS ENUM ('draft', 'approved', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.angles ADD COLUMN IF NOT EXISTS hook_seed text;
ALTER TABLE public.angles ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;

-- Convert status to enum
ALTER TABLE public.angles ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.angles
  ALTER COLUMN status TYPE public.angle_status
  USING (
    CASE
      WHEN status IN ('draft','approved','archived') THEN status::public.angle_status
      ELSE 'draft'::public.angle_status
    END
  );
ALTER TABLE public.angles ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.angles ALTER COLUMN status SET DEFAULT 'draft'::public.angle_status;
