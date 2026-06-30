
ALTER FUNCTION public.guard_credit_ledger_update() SET search_path = public;
ALTER FUNCTION public.guard_credit_ledger_sign() SET search_path = public;

-- Trigger-only functions: revoke EXECUTE from everyone except service_role.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_credit_ledger_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_credit_ledger_sign() FROM PUBLIC, anon, authenticated;

-- RPCs callable from the app: keep authenticated/service_role only.
REVOKE EXECUTE ON FUNCTION public.get_balance(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
