-- Schedule the stale-generation reaper every 15 minutes.
--
-- REQUIRES two one-time manual steps in the Supabase dashboard:
--   1. Set the REAPER_SECRET secret on the reap-stale-generations edge
--      function (any long random string).
--   2. Replace the two placeholders below (PROJECT_REF and the secret)
--      before applying, OR store them in Vault and reference them.
--
-- pg_cron + pg_net ship enabled on Supabase projects; the CREATE EXTENSION
-- lines are idempotent safety.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous schedule with the same name (idempotent re-apply).
DO $$
BEGIN
  PERFORM cron.unschedule('reap-stale-generations');
EXCEPTION WHEN OTHERS THEN
  NULL; -- not scheduled yet
END $$;

SELECT cron.schedule(
  'reap-stale-generations',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rswmvgrxhqynspuxmcep.supabase.co/functions/v1/reap-stale-generations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-reaper-secret', '__SET_REAPER_SECRET_BEFORE_APPLYING__'
    ),
    body := '{}'::jsonb
  );
  $$
);
