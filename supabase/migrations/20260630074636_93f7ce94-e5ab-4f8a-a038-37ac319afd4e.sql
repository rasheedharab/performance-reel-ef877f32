
-- =====================================================================
-- ENUMS
-- =====================================================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'user');
CREATE TYPE public.account_status AS ENUM ('active', 'suspended');
CREATE TYPE public.display_currency AS ENUM ('INR', 'USD');
CREATE TYPE public.ledger_type AS ENUM ('topup', 'debit', 'refund', 'adjustment');
CREATE TYPE public.ledger_status AS ENUM ('reserved', 'captured', 'refunded', 'posted');
CREATE TYPE public.ledger_entity_type AS ENUM ('brand', 'brief', 'angle', 'script', 'shot', 'asset', 'frame', 'none');
CREATE TYPE public.pricing_unit AS ENUM ('per_second', 'per_image', 'per_1k_input_tokens', 'per_1k_output_tokens', 'per_1k_chars', 'per_call');

-- =====================================================================
-- PROFILES
-- =====================================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role public.app_role NOT NULL DEFAULT 'user',
  account_status public.account_status NOT NULL DEFAULT 'active',
  display_currency public.display_currency NOT NULL DEFAULT 'INR',
  fx_rate_inr_per_usd numeric(12,4) NOT NULL DEFAULT 88.0 CHECK (fx_rate_inr_per_usd > 0),
  markup_multiplier numeric(8,4) NOT NULL DEFAULT 1.5 CHECK (markup_multiplier > 0),
  low_balance_threshold numeric(14,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- SECURITY DEFINER ROLE CHECK (avoid recursive RLS)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = _role AND account_status = 'active'
  )
$$;

-- =====================================================================
-- PROFILES RLS
-- =====================================================================
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Users update own profile (wallet prefs only)"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Super admins manage all profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- =====================================================================
-- TRIGGERS: protect role/account_status; updated_at; auto-create profile
-- =====================================================================
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_super boolean;
  any_super_exists boolean;
BEGIN
  is_super := public.has_role(auth.uid(), 'super_admin');
  IF is_super THEN
    RETURN NEW;
  END IF;

  -- Bootstrap: if no super_admin exists yet, allow the very first promotion.
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'super_admin')
    INTO any_super_exists;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF any_super_exists THEN
      RAISE EXCEPTION 'Only super_admin can change role';
    END IF;
  END IF;

  IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
    RAISE EXCEPTION 'Only super_admin can change account_status';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect_privileged
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing users
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- PRICING CONFIG
-- =====================================================================
CREATE TABLE public.pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL,
  model_id text NOT NULL,
  unit public.pricing_unit NOT NULL,
  usd_unit_cost numeric(14,6) NOT NULL CHECK (usd_unit_cost >= 0),
  label text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operation, model_id, unit)
);

GRANT SELECT ON public.pricing_config TO authenticated;
GRANT ALL ON public.pricing_config TO service_role;

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read pricing"
  ON public.pricing_config FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super admins manage pricing"
  ON public.pricing_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER pricing_config_set_updated_at
  BEFORE UPDATE ON public.pricing_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed pricing config (placeholder USD rates — confirm against provider docs)
INSERT INTO public.pricing_config (operation, model_id, unit, usd_unit_cost, label, notes) VALUES
  -- fal.ai video (per second)
  ('video_generation', 'fal-ai/veo3',                       'per_second', 0.50,   'Veo 3',                 'Placeholder — confirm with fal.ai pricing'),
  ('video_generation', 'fal-ai/veo3/fast',                  'per_second', 0.10,   'Veo 3 Fast',            'Placeholder — confirm with fal.ai pricing'),
  ('video_generation', 'fal-ai/veo2',                       'per_second', 0.50,   'Veo 2',                 'Placeholder — confirm with fal.ai pricing'),
  ('video_generation', 'fal-ai/kling-video/v2.1/master',    'per_second', 0.28,   'Kling 2.1 Master',      'Placeholder — confirm with fal.ai pricing'),
  ('video_generation', 'fal-ai/kling-video/v2.1/pro',       'per_second', 0.09,   'Kling 2.1 Pro',         'Placeholder — confirm with fal.ai pricing'),
  ('video_generation', 'fal-ai/kling-video/v2.1/standard',  'per_second', 0.05,   'Kling 2.1 Standard',    'Placeholder — confirm with fal.ai pricing'),
  ('video_generation', 'fal-ai/runway-gen4',                'per_second', 0.10,   'Runway Gen-4',          'Placeholder — confirm with fal.ai pricing'),
  ('video_generation', 'fal-ai/minimax/hailuo',             'per_second', 0.08,   'MiniMax / Hailuo',      'Placeholder — confirm with fal.ai pricing'),
  ('video_generation', 'fal-ai/pika',                       'per_second', 0.08,   'Pika',                  'Placeholder — confirm with fal.ai pricing'),

  -- fal.ai image (per image)
  ('image_generation', 'fal-ai/flux-2/pro',                 'per_image', 0.05,    'Flux 2 Pro',            'Placeholder — confirm with fal.ai pricing'),
  ('image_generation', 'fal-ai/flux-2/flash',               'per_image', 0.01,    'Flux 2 Flash',          'Placeholder — confirm with fal.ai pricing'),
  ('image_generation', 'fal-ai/flux-pro/kontext',           'per_image', 0.04,    'Flux Kontext (edit)',   'Placeholder — confirm with fal.ai pricing'),
  ('image_generation', 'fal-ai/ideogram/v3',                'per_image', 0.04,    'Ideogram V3',           'Placeholder — confirm with fal.ai pricing'),
  ('image_generation', 'fal-ai/bytedance/seedream/v4.5',    'per_image', 0.03,    'Seedream 4.5',          'Placeholder — confirm with fal.ai pricing'),
  ('image_generation', 'fal-ai/bytedance/seedream/v4.5-lite','per_image', 0.01,   'Seedream 4.5 Lite',     'Placeholder — confirm with fal.ai pricing'),
  ('image_generation', 'fal-ai/bytedance/seedream/v4.5/edit','per_image', 0.04,   'Seedream 4.5 Edit',     'Placeholder — confirm with fal.ai pricing'),
  ('image_generation', 'fal-ai/imagen4/preview',            'per_image', 0.04,    'Imagen 4',              'Placeholder — confirm with fal.ai pricing'),

  -- ElevenLabs (per 1k chars)
  ('voiceover', 'elevenlabs/eleven_multilingual_v2',        'per_1k_chars', 0.30, 'ElevenLabs Multilingual v2', 'Placeholder — confirm with ElevenLabs pricing tier'),
  ('voiceover', 'elevenlabs/eleven_turbo_v2_5',             'per_1k_chars', 0.15, 'ElevenLabs Turbo v2.5',  'Placeholder — confirm with ElevenLabs pricing tier'),

  -- Anthropic (per 1k tokens)
  ('ai_assist', 'claude-sonnet-4-6', 'per_1k_input_tokens',  0.003, 'Claude Sonnet 4.6 (input)',  'Placeholder — confirm with Anthropic pricing'),
  ('ai_assist', 'claude-sonnet-4-6', 'per_1k_output_tokens', 0.015, 'Claude Sonnet 4.6 (output)', 'Placeholder — confirm with Anthropic pricing'),
  ('ai_assist', 'claude-opus-4-1',   'per_1k_input_tokens',  0.015, 'Claude Opus 4.1 (input)',    'Placeholder — confirm with Anthropic pricing'),
  ('ai_assist', 'claude-opus-4-1',   'per_1k_output_tokens', 0.075, 'Claude Opus 4.1 (output)',   'Placeholder — confirm with Anthropic pricing'),
  ('ai_assist', 'claude-haiku-4-5',  'per_1k_input_tokens',  0.001, 'Claude Haiku 4.5 (input)',   'Placeholder — confirm with Anthropic pricing'),
  ('ai_assist', 'claude-haiku-4-5',  'per_1k_output_tokens', 0.005, 'Claude Haiku 4.5 (output)',  'Placeholder — confirm with Anthropic pricing');

-- =====================================================================
-- CREDIT LEDGER
-- =====================================================================
CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.ledger_type NOT NULL,
  status public.ledger_status NOT NULL DEFAULT 'posted',

  usd_cost numeric(14,6),
  fx_rate numeric(14,6) NOT NULL,
  markup numeric(8,4) NOT NULL DEFAULT 1.0,
  amount numeric(16,4) NOT NULL,
  currency public.display_currency NOT NULL,

  operation text,
  model_id text,

  entity_type public.ledger_entity_type NOT NULL DEFAULT 'none',
  entity_id uuid,

  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  brief_id uuid REFERENCES public.briefs(id) ON DELETE SET NULL,

  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX credit_ledger_user_created_idx ON public.credit_ledger(user_id, created_at DESC);
CREATE INDEX credit_ledger_user_status_idx ON public.credit_ledger(user_id, status);
CREATE INDEX credit_ledger_brand_idx ON public.credit_ledger(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX credit_ledger_brief_idx ON public.credit_ledger(brief_id) WHERE brief_id IS NOT NULL;
CREATE INDEX credit_ledger_entity_idx ON public.credit_ledger(entity_type, entity_id) WHERE entity_id IS NOT NULL;

-- Regular users get SELECT only; INSERT/UPDATE/DELETE flow through service role + super_admin.
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own ledger"
  ON public.credit_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin inserts ledger"
  ON public.credit_ledger FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin updates ledger"
  ON public.credit_ledger FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- No DELETE policy → effectively forbidden for anyone except service_role (bypasses RLS).

-- Hard guard: even super_admin cannot mutate a non-reserved row's financial fields.
CREATE OR REPLACE FUNCTION public.guard_credit_ledger_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status <> 'reserved' THEN
    -- Only status transitions on reserved rows are meaningful; everything else is locked.
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.usd_cost IS DISTINCT FROM OLD.usd_cost
       OR NEW.fx_rate IS DISTINCT FROM OLD.fx_rate
       OR NEW.markup IS DISTINCT FROM OLD.markup
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Posted ledger rows are immutable (only reserved rows can transition)';
    END IF;
  ELSE
    -- Reserved rows may only transition to captured / refunded.
    IF NEW.status NOT IN ('reserved', 'captured', 'refunded') THEN
      RAISE EXCEPTION 'Invalid ledger status transition from reserved → %', NEW.status;
    END IF;
    -- Financial fields stay locked through capture; refund is a NEW row, not a mutation.
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.currency IS DISTINCT FROM OLD.currency THEN
      RAISE EXCEPTION 'Cannot modify financial fields on a ledger row';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER credit_ledger_guard
  BEFORE UPDATE ON public.credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.guard_credit_ledger_update();

-- Hard guard: signs must match type
CREATE OR REPLACE FUNCTION public.guard_credit_ledger_sign()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.type IN ('topup', 'refund') AND NEW.amount < 0 THEN
    RAISE EXCEPTION '% rows require positive amount', NEW.type;
  END IF;
  IF NEW.type = 'debit' AND NEW.amount > 0 THEN
    RAISE EXCEPTION 'debit rows require non-positive amount';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER credit_ledger_sign
  BEFORE INSERT ON public.credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.guard_credit_ledger_sign();

-- =====================================================================
-- BALANCE RPC
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_balance(p_user_id uuid)
RETURNS TABLE (
  available numeric,
  total_topped_up numeric,
  total_consumed numeric,
  reserved_amount numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow self-read or super_admin
  IF p_user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE status IN ('captured','posted','refunded')), 0) AS posted_sum,
      COALESCE(SUM(amount) FILTER (WHERE status = 'reserved'), 0)                         AS reserved_sum,
      COALESCE(SUM(amount) FILTER (WHERE type IN ('topup','refund') AND status IN ('captured','posted','refunded')), 0) AS topped,
      COALESCE(SUM(-amount) FILTER (WHERE type = 'debit' AND status IN ('captured','posted')), 0) AS consumed
    FROM public.credit_ledger
    WHERE user_id = p_user_id
  )
  SELECT
    (posted_sum + reserved_sum)::numeric AS available,
    topped::numeric AS total_topped_up,
    consumed::numeric AS total_consumed,
    (-reserved_sum)::numeric AS reserved_amount
  FROM base;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_balance(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
