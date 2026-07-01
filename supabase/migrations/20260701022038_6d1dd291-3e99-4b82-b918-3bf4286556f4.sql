
-- 1. Profiles: prevent privilege escalation via WITH CHECK
DROP POLICY IF EXISTS "Users update own profile (wallet prefs only)" ON public.profiles;
CREATE POLICY "Users update own profile (wallet prefs only)"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  AND account_status = (SELECT p.account_status FROM public.profiles p WHERE p.id = auth.uid())
  AND markup_multiplier = (SELECT p.markup_multiplier FROM public.profiles p WHERE p.id = auth.uid())
  AND fx_rate_inr_per_usd = (SELECT p.fx_rate_inr_per_usd FROM public.profiles p WHERE p.id = auth.uid())
  AND per_user_spend_cap IS NOT DISTINCT FROM (SELECT p.per_user_spend_cap FROM public.profiles p WHERE p.id = auth.uid())
);

-- 2. Leads: replace WITH CHECK (true) with input validation
DROP POLICY IF EXISTS "anyone can submit a lead" ON public.leads;
CREATE POLICY "anyone can submit a lead"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  char_length(btrim(name)) BETWEEN 1 AND 200
  AND char_length(btrim(email)) BETWEEN 3 AND 254
  AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND (company IS NULL OR char_length(company) <= 200)
  AND (message IS NULL OR char_length(message) <= 2000)
  AND (source IS NULL OR char_length(source) <= 50)
);

-- 3. Convert user-callable SECURITY DEFINER functions to SECURITY INVOKER.
-- These rely on existing RLS policies (own-row + super_admin) and internal has_role checks.
ALTER FUNCTION public.has_role(uuid, app_role) SECURITY INVOKER;
ALTER FUNCTION public.get_balance(uuid) SECURITY INVOKER;
ALTER FUNCTION public.admin_topup_credit(uuid, numeric, text) SECURITY INVOKER;
ALTER FUNCTION public.admin_platform_overview() SECURITY INVOKER;

-- Restrict admin_platform_overview to authenticated only (previously anon-executable).
REVOKE EXECUTE ON FUNCTION public.admin_platform_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_platform_overview() TO authenticated;

-- 4. Reserve/capture/refund credit helpers are backend-only (called via service role).
-- Switch to SECURITY INVOKER and revoke from client roles.
ALTER FUNCTION public.reserve_credit(uuid, numeric, text, text, ledger_entity_type, uuid, uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.capture_credit(uuid, numeric) SECURITY INVOKER;
ALTER FUNCTION public.refund_credit(uuid) SECURITY INVOKER;

REVOKE EXECUTE ON FUNCTION public.reserve_credit(uuid, numeric, text, text, ledger_entity_type, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_credit(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_credit(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_credit(uuid, numeric, text, text, ledger_entity_type, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.capture_credit(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credit(uuid) TO service_role;
