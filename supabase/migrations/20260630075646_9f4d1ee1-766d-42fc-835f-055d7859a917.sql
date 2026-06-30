
-- Per-brief spend cap & optional per-user spend cap
ALTER TABLE public.briefs ADD COLUMN IF NOT EXISTS spend_cap numeric NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS per_user_spend_cap numeric NULL;

-- Allow super_admin to read all brands and briefs (for admin views)
DROP POLICY IF EXISTS "Super admins read all brands" ON public.brands;
CREATE POLICY "Super admins read all brands" ON public.brands
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins read all briefs" ON public.briefs;
CREATE POLICY "Super admins read all briefs" ON public.briefs
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

-- Super-admin top-up RPC: inserts a positive 'topup' ledger row in the target user's currency.
CREATE OR REPLACE FUNCTION public.admin_topup_credit(
  p_user_id uuid,
  p_amount numeric,
  p_note text DEFAULT NULL
) RETURNS TABLE(ledger_id uuid, new_balance numeric, currency display_currency)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_new_id uuid;
  v_bal numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super_admin can top up credits';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;

  INSERT INTO public.credit_ledger(
    user_id, type, status, usd_cost, fx_rate, markup, amount, currency,
    operation, entity_type, created_by, note
  ) VALUES (
    p_user_id, 'topup', 'posted', NULL,
    CASE WHEN v_profile.display_currency = 'INR' THEN v_profile.fx_rate_inr_per_usd ELSE 1 END,
    v_profile.markup_multiplier,
    p_amount, v_profile.display_currency,
    'topup', 'none', auth.uid(),
    COALESCE(p_note, 'manual top-up')
  ) RETURNING id INTO v_new_id;

  SELECT (COALESCE(SUM(amount) FILTER (WHERE status IN ('captured','posted','refunded')),0)
        + COALESCE(SUM(amount) FILTER (WHERE status = 'reserved'),0))::numeric
    INTO v_bal
    FROM public.credit_ledger WHERE user_id = p_user_id;

  ledger_id := v_new_id;
  new_balance := v_bal;
  currency := v_profile.display_currency;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_topup_credit(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_topup_credit(uuid, numeric, text) TO authenticated;

-- Update reserve_credit to enforce brief.spend_cap and per_user_spend_cap
CREATE OR REPLACE FUNCTION public.reserve_credit(
  p_user_id uuid, p_estimated_usd numeric, p_operation text, p_model_id text,
  p_entity_type ledger_entity_type, p_entity_id uuid, p_brand_id uuid, p_brief_id uuid
) RETURNS TABLE(ledger_id uuid, charged_amount numeric, currency display_currency, available_after numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_charged numeric;
  v_avail numeric;
  v_fx numeric;
  v_new_id uuid;
  v_brief_cap numeric;
  v_brief_spent numeric;
  v_user_spent numeric;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id is required'; END IF;
  IF p_estimated_usd IS NULL OR p_estimated_usd < 0 THEN
    RAISE EXCEPTION 'estimated_usd must be non-negative';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0001'; END IF;
  IF v_profile.account_status <> 'active' THEN
    RAISE EXCEPTION 'account_suspended' USING ERRCODE = 'P0001';
  END IF;

  v_fx := CASE WHEN v_profile.display_currency = 'INR'
               THEN v_profile.fx_rate_inr_per_usd ELSE 1 END;
  v_charged := round((p_estimated_usd * v_profile.markup_multiplier * v_fx)::numeric, 4);

  SELECT (COALESCE(SUM(amount) FILTER (WHERE status IN ('captured','posted','refunded')),0)
        + COALESCE(SUM(amount) FILTER (WHERE status = 'reserved'),0))::numeric
    INTO v_avail
    FROM public.credit_ledger WHERE user_id = p_user_id;

  IF v_avail < v_charged THEN
    RAISE EXCEPTION 'insufficient_credits: required=% available=%', v_charged, v_avail
      USING ERRCODE = 'P0002';
  END IF;

  -- Per-brief spend cap
  IF p_brief_id IS NOT NULL THEN
    SELECT spend_cap INTO v_brief_cap FROM public.briefs WHERE id = p_brief_id;
    IF v_brief_cap IS NOT NULL THEN
      SELECT COALESCE(SUM(-amount),0)::numeric INTO v_brief_spent
        FROM public.credit_ledger
       WHERE brief_id = p_brief_id
         AND type = 'debit'
         AND status IN ('reserved','captured');
      IF (v_brief_spent + v_charged) > v_brief_cap THEN
        RAISE EXCEPTION 'brief_cap_exceeded: cap=% spent=% required=%',
          v_brief_cap, v_brief_spent, v_charged USING ERRCODE = 'P0003';
      END IF;
    END IF;
  END IF;

  -- Per-user spend cap (optional)
  IF v_profile.per_user_spend_cap IS NOT NULL THEN
    SELECT COALESCE(SUM(-amount),0)::numeric INTO v_user_spent
      FROM public.credit_ledger
     WHERE user_id = p_user_id AND type='debit' AND status IN ('reserved','captured');
    IF (v_user_spent + v_charged) > v_profile.per_user_spend_cap THEN
      RAISE EXCEPTION 'user_cap_exceeded: cap=% spent=% required=%',
        v_profile.per_user_spend_cap, v_user_spent, v_charged USING ERRCODE = 'P0004';
    END IF;
  END IF;

  INSERT INTO public.credit_ledger(
    user_id, type, status, usd_cost, fx_rate, markup, amount, currency,
    operation, model_id, entity_type, entity_id, brand_id, brief_id, created_by, note
  ) VALUES (
    p_user_id, 'debit', 'reserved', p_estimated_usd,
    v_fx, v_profile.markup_multiplier, -v_charged, v_profile.display_currency,
    p_operation, p_model_id,
    COALESCE(p_entity_type, 'none'::ledger_entity_type),
    p_entity_id, p_brand_id, p_brief_id, p_user_id, 'reserve'
  ) RETURNING id INTO v_new_id;

  ledger_id := v_new_id;
  charged_amount := v_charged;
  currency := v_profile.display_currency;
  available_after := v_avail - v_charged;
  RETURN NEXT;
END;
$$;

-- Platform overview RPC (super_admin only): totals
CREATE OR REPLACE FUNCTION public.admin_platform_overview()
RETURNS TABLE(
  total_users bigint,
  active_users bigint,
  suspended_users bigint,
  total_topped_up_usd numeric,
  total_consumed_usd numeric,
  total_charged_usd_equiv numeric,
  total_reserved_usd numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.profiles),
    (SELECT count(*) FROM public.profiles WHERE account_status='active'),
    (SELECT count(*) FROM public.profiles WHERE account_status='suspended'),
    COALESCE((SELECT SUM(amount/NULLIF(fx_rate,0)/NULLIF(markup,0)) FROM public.credit_ledger
       WHERE type='topup' AND status='posted'), 0)::numeric,
    COALESCE((SELECT SUM(usd_cost) FROM public.credit_ledger
       WHERE type='debit' AND status='captured'), 0)::numeric,
    COALESCE((SELECT SUM(-amount/NULLIF(fx_rate,0)) FROM public.credit_ledger
       WHERE type='debit' AND status='captured'), 0)::numeric,
    COALESCE((SELECT SUM(-amount/NULLIF(fx_rate,0)) FROM public.credit_ledger
       WHERE type='debit' AND status='reserved'), 0)::numeric;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_platform_overview() TO authenticated;
