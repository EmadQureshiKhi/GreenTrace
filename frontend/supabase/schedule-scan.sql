-- Schedules the exchange scan: Supabase's pg_cron calls the app's /api/internal/scan every minute through
-- pg_net. Run once per environment (not a migration: it names the deployed URL, and a plain Postgres
-- has neither extension):
--   psql "$SUPABASE_DB_URL" -v app_url=https://greentrace-app.vercel.app -f supabase/schedule-scan.sql
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'greentrace-exchange-scan';

select cron.schedule(
  'greentrace-exchange-scan',
  '* * * * *',
  format(
    $job$select net.http_post(url := %L, headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb, timeout_milliseconds := 60000)$job$,
    :'app_url' || '/api/internal/scan'
  )
);

select jobid, jobname, schedule, active from cron.job where jobname = 'greentrace-exchange-scan';
