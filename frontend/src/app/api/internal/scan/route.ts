import { route } from '@/server/http';
import { scanExchange } from '@/server/services/exchange-scan';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Called every minute by Supabase pg_cron (supabase/schedule-scan.sql). It needs no credentials: it takes
// no input, only completes purchases and retirements the mirror node shows, is idempotent, and spaces
// its own runs (see exchange-scan.ts).
const run = route(async () => scanExchange());
export const POST = run;
export const GET = run;
