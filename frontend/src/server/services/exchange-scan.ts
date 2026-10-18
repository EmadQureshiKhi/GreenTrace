import 'server-only';
import { chainConfig } from '@/lib/chain-config';
import { advanceCursor, transactionsIn, type ScanOutcome } from '@/lib/exchange-scan';
import { HttpError } from '../http';
import { getContractLogsSince } from '../mirror';
import { supabaseAdmin } from '../supabase-admin';
import { reconcileExchangeTransaction } from './reconcile';

// The scheduled reconciler. Supabase's pg_cron calls /api/internal/scan every minute; each run reads the
// exchange contract's new events from the mirror node and completes the purchases and retirements behind
// them, so they finish even when the buyer closed the tab right after paying. The cursor lives in
// exchange_scan_state; a short lease makes overlapping runs (a slow run, a manual trigger) skip.

const LEASE_SECONDS = 50;
/** The endpoint needs no secret (it takes no input and only completes what the chain shows), so runs are spaced. */
const MIN_INTERVAL_SECONDS = 15;
const BUDGET_MS = 40_000;

export interface ScanResult {
  skipped?: 'busy';
  seen: number;
  done: number;
  declined: number;
  retry: number;
  cursor: string;
}

export async function scanExchange(): Promise<ScanResult> {
  const db = supabaseAdmin();
  const now = new Date();
  // Claim the lease: one statement, so only one caller can win it.
  const { data: claimed, error } = await db
    .from('exchange_scan_state')
    .update({ lease_until: new Date(now.getTime() + LEASE_SECONDS * 1000).toISOString() })
    .eq('id', 1)
    .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
    .or(`last_run_at.is.null,last_run_at.lt.${new Date(now.getTime() - MIN_INTERVAL_SECONDS * 1000).toISOString()}`)
    .select('cursor')
    .maybeSingle<{ cursor: string }>();
  if (error) throw error;
  if (!claimed) return { skipped: 'busy', seen: 0, done: 0, declined: 0, retry: 0, cursor: '' };

  const started = Date.now();
  const handled: { timestamp: string; outcome: ScanOutcome }[] = [];
  let lastError: string | null = null;
  try {
    const contractId = chainConfig.exchangeContractId;
    if (!contractId) throw new Error('NEXT_PUBLIC_EXCHANGE_CONTRACT_ID is not set');
    for (const tx of transactionsIn(await getContractLogsSince(contractId, claimed.cursor))) {
      if (Date.now() - started > BUDGET_MS) break;
      let outcome: ScanOutcome;
      try {
        await reconcileExchangeTransaction(tx.hash);
        outcome = 'done';
      } catch (e) {
        // A 4xx means the app looked and declined (an unknown order, a wrong amount): never retry it.
        outcome = e instanceof HttpError && e.status < 500 ? 'declined' : 'retry';
        lastError = `${tx.hash}: ${e instanceof Error ? e.message : String(e)}`;
      }
      handled.push({ timestamp: tx.timestamp, outcome });
      if (outcome === 'retry') break;
    }
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
  }

  const cursor = advanceCursor(claimed.cursor, handled);
  await db
    .from('exchange_scan_state')
    .update({ cursor, lease_until: null, last_run_at: new Date().toISOString(), last_error: lastError })
    .eq('id', 1);
  const count = (o: ScanOutcome) => handled.filter((h) => h.outcome === o).length;
  return { seen: handled.length, done: count('done'), declined: count('declined'), retry: count('retry'), cursor };
}
