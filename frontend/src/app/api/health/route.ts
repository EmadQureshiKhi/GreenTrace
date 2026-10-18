import { chainConfig } from '@/lib/chain-config';
import { route } from '@/server/http';
import { supabaseAdmin } from '@/server/supabase-admin';

export const dynamic = 'force-dynamic';

/** When the scheduled exchange scan last finished, and whether that is recent (it runs every minute). */
async function scanStatus() {
  try {
    const { data } = await supabaseAdmin().from('exchange_scan_state').select('last_run_at').eq('id', 1).maybeSingle<{ last_run_at: string | null }>();
    const last = data?.last_run_at ?? null;
    return { lastRunAt: last, healthy: last !== null && Date.now() - Date.parse(last) < 5 * 60_000 };
  } catch {
    return { lastRunAt: null, healthy: false };
  }
}

// Which parts of the system are configured. Reports presence only, never values.
export const GET = route(async () => ({
  supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY),
  hedera: {
    operator: Boolean(process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY),
    topic: Boolean(chainConfig.topicId),
    co2eToken: Boolean(chainConfig.co2eTokenId),
    certificateToken: Boolean(chainConfig.certificateTokenId),
    exchangeContract: Boolean(chainConfig.exchangeContractId),
  },
  ai: Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
  ipfsPinning: Boolean(process.env.PINATA_JWT),
  exchangeScan: await scanStatus(),
}));
