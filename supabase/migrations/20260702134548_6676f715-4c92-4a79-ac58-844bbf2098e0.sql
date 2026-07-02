
DROP POLICY IF EXISTS "Users update own profile (wallet prefs only)" ON public.profiles;

CREATE POLICY "Users update own profile (wallet prefs only)"
ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  AND account_status = (SELECT p.account_status FROM public.profiles p WHERE p.id = auth.uid())
  AND markup_multiplier = (SELECT p.markup_multiplier FROM public.profiles p WHERE p.id = auth.uid())
  AND fx_rate_inr_per_usd = (SELECT p.fx_rate_inr_per_usd FROM public.profiles p WHERE p.id = auth.uid())
  AND NOT (per_user_spend_cap IS DISTINCT FROM (SELECT p.per_user_spend_cap FROM public.profiles p WHERE p.id = auth.uid()))
  AND NOT (low_balance_threshold IS DISTINCT FROM (SELECT p.low_balance_threshold FROM public.profiles p WHERE p.id = auth.uid()))
);
