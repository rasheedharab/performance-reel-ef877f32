
-- Relax update guard to allow captured -> refunded (failure refund of a captured row)
CREATE OR REPLACE FUNCTION public.guard_credit_ledger_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status = 'reserved' THEN
    IF NEW.status NOT IN ('reserved', 'captured', 'refunded') THEN
      RAISE EXCEPTION 'Invalid ledger status transition from reserved → %', NEW.status;
    END IF;
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.currency IS DISTINCT FROM OLD.currency THEN
      RAISE EXCEPTION 'Cannot modify financial fields on a ledger row';
    END IF;
  ELSIF OLD.status = 'captured' THEN
    IF NEW.status = OLD.status THEN
      IF NEW.amount IS DISTINCT FROM OLD.amount
         OR NEW.usd_cost IS DISTINCT FROM OLD.usd_cost
         OR NEW.fx_rate IS DISTINCT FROM OLD.fx_rate
         OR NEW.markup IS DISTINCT FROM OLD.markup
         OR NEW.user_id IS DISTINCT FROM OLD.user_id
         OR NEW.type IS DISTINCT FROM OLD.type
         OR NEW.currency IS DISTINCT FROM OLD.currency THEN
        RAISE EXCEPTION 'Posted ledger rows are immutable';
      END IF;
    ELSIF NEW.status = 'refunded' THEN
      IF NEW.amount IS DISTINCT FROM OLD.amount
         OR NEW.user_id IS DISTINCT FROM OLD.user_id
         OR NEW.type IS DISTINCT FROM OLD.type
         OR NEW.currency IS DISTINCT FROM OLD.currency THEN
        RAISE EXCEPTION 'Cannot modify financial fields on a ledger row';
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid ledger status transition from captured → %', NEW.status;
    END IF;
  ELSE
    -- posted / refunded are terminal
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.currency IS DISTINCT FROM OLD.currency THEN
      RAISE EXCEPTION 'Posted ledger rows are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure triggers are attached (idempotent)
DROP TRIGGER IF EXISTS guard_credit_ledger_update_trg ON public.credit_ledger;
CREATE TRIGGER guard_credit_ledger_update_trg
  BEFORE UPDATE ON public.credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.guard_credit_ledger_update();

DROP TRIGGER IF EXISTS guard_credit_ledger_sign_trg ON public.credit_ledger;
CREATE TRIGGER guard_credit_ledger_sign_trg
  BEFORE INSERT ON public.credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.guard_credit_ledger_sign();

-- ============================================================
-- reserve_credit: atomic check-and-hold
-- ============================================================
CREATE OR REPLACE FUNCTION public.reserve_credit(
  p_user_id uuid,
  p_estimated_usd numeric,
  p_operation text,
  p_model_id text,
  p_entity_type ledger_entity_type,
  p_entity_id uuid,
  p_brand_id uuid,
  p_brief_id uuid
)
RETURNS TABLE(ledger_id uuid, charged_amount numeric, currency display_currency, available_after numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_charged numeric;
  v_avail numeric;
  v_fx numeric;
  v_new_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;
  IF p_estimated_usd IS NULL OR p_estimated_usd < 0 THEN
    RAISE EXCEPTION 'estimated_usd must be non-negative';
  END IF;

  -- Lock the profile row to serialize concurrent reserves for this user.
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_profile.account_status <> 'active' THEN
    RAISE EXCEPTION 'account_suspended' USING ERRCODE = 'P0001';
  END IF;

  v_fx := CASE WHEN v_profile.display_currency = 'INR'
               THEN v_profile.fx_rate_inr_per_usd ELSE 1 END;
  v_charged := round((p_estimated_usd * v_profile.markup_multiplier * v_fx)::numeric, 4);

  -- Available balance (posted + reserved sums; reserved amounts are negative)
  SELECT (COALESCE(SUM(amount) FILTER (WHERE status IN ('captured','posted','refunded')), 0)
        + COALESCE(SUM(amount) FILTER (WHERE status = 'reserved'), 0))::numeric
    INTO v_avail
    FROM public.credit_ledger
   WHERE user_id = p_user_id;

  IF v_avail < v_charged THEN
    RAISE EXCEPTION 'insufficient_credits: required=% available=%', v_charged, v_avail
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.credit_ledger(
    user_id, type, status, usd_cost, fx_rate, markup, amount, currency,
    operation, model_id, entity_type, entity_id, brand_id, brief_id, created_by, note
  ) VALUES (
    p_user_id, 'debit', 'reserved', p_estimated_usd,
    v_fx, v_profile.markup_multiplier, -v_charged, v_profile.display_currency,
    p_operation, p_model_id,
    COALESCE(p_entity_type, 'none'::ledger_entity_type),
    p_entity_id, p_brand_id, p_brief_id, p_user_id,
    'reserve'
  ) RETURNING id INTO v_new_id;

  ledger_id := v_new_id;
  charged_amount := v_charged;
  currency := v_profile.display_currency;
  available_after := v_avail - v_charged;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_credit(uuid, numeric, text, text, ledger_entity_type, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_credit(uuid, numeric, text, text, ledger_entity_type, uuid, uuid, uuid) TO service_role;

-- ============================================================
-- capture_credit: finalise a reservation with real spend
-- ============================================================
CREATE OR REPLACE FUNCTION public.capture_credit(
  p_ledger_id uuid,
  p_actual_usd numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.credit_ledger%ROWTYPE;
  v_actual_amt numeric;
  v_reserved_amt numeric;
  v_diff numeric;
BEGIN
  SELECT * INTO v_row FROM public.credit_ledger
    WHERE id = p_ledger_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ledger_row_not_found'; END IF;
  IF v_row.status <> 'reserved' THEN
    RAISE EXCEPTION 'cannot_capture_status_%', v_row.status;
  END IF;
  IF p_actual_usd IS NULL OR p_actual_usd < 0 THEN
    p_actual_usd := COALESCE(v_row.usd_cost, 0);
  END IF;

  v_reserved_amt := -v_row.amount; -- positive magnitude held
  v_actual_amt := round((p_actual_usd * v_row.markup *
    CASE WHEN v_row.currency = 'INR' THEN v_row.fx_rate ELSE 1 END)::numeric, 4);

  UPDATE public.credit_ledger
     SET status = 'captured',
         usd_cost = p_actual_usd,
         note = 'capture'
   WHERE id = p_ledger_id;

  v_diff := v_reserved_amt - v_actual_amt;
  IF v_diff > 0 THEN
    INSERT INTO public.credit_ledger(
      user_id, type, status, usd_cost, fx_rate, markup, amount, currency,
      operation, model_id, entity_type, entity_id, brand_id, brief_id, created_by, note
    ) VALUES (
      v_row.user_id, 'refund', 'posted', NULL, v_row.fx_rate, v_row.markup,
      v_diff, v_row.currency,
      v_row.operation, v_row.model_id, v_row.entity_type, v_row.entity_id,
      v_row.brand_id, v_row.brief_id, v_row.user_id,
      'capture true-up for ' || p_ledger_id::text
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.capture_credit(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_credit(uuid, numeric) TO service_role;

-- ============================================================
-- refund_credit: reverse a reserved or captured row
-- ============================================================
CREATE OR REPLACE FUNCTION public.refund_credit(p_ledger_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.credit_ledger%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.credit_ledger
    WHERE id = p_ledger_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ledger_row_not_found'; END IF;
  IF v_row.status NOT IN ('reserved', 'captured') THEN
    RAISE EXCEPTION 'cannot_refund_status_%', v_row.status;
  END IF;

  UPDATE public.credit_ledger
     SET status = 'refunded',
         note = COALESCE(note, '') || ' [refunded]'
   WHERE id = p_ledger_id;

  INSERT INTO public.credit_ledger(
    user_id, type, status, usd_cost, fx_rate, markup, amount, currency,
    operation, model_id, entity_type, entity_id, brand_id, brief_id, created_by, note
  ) VALUES (
    v_row.user_id, 'refund', 'posted', v_row.usd_cost, v_row.fx_rate, v_row.markup,
    -v_row.amount, v_row.currency,
    v_row.operation, v_row.model_id, v_row.entity_type, v_row.entity_id,
    v_row.brand_id, v_row.brief_id, v_row.user_id,
    'compensating refund for ' || p_ledger_id::text
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_credit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_credit(uuid) TO service_role;
