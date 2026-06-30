
REVOKE EXECUTE ON FUNCTION public.reserve_credit(uuid, numeric, text, text, ledger_entity_type, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_credit(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_credit(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_credit(uuid, numeric, text, text, ledger_entity_type, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.capture_credit(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_credit(uuid) TO service_role;
