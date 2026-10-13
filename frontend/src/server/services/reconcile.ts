import 'server-only';
import { loadExchangeTransaction } from './exchange-events';
import { fulfilPurchase } from './orders';
import { processRetirement } from './retirements';

/**
 * Verifies an exchange transaction on the mirror node and completes what it pays for or requests.
 * Idempotent: the browser, the scheduled scan and the optional listener may all report the same hash.
 */
export async function reconcileExchangeTransaction(txHash: string) {
  const { events } = await loadExchangeTransaction(txHash);
  if (events.some((e) => e.kind === 'purchase')) return { kind: 'purchase' as const, order: await fulfilPurchase(txHash) };
  if (events.some((e) => e.kind === 'retirement')) return { kind: 'retirement' as const, retirement: await processRetirement(txHash) };
  return { kind: 'none' as const };
}
