// The scheduled reconciler's bookkeeping, kept pure so it can be tested: which transactions a batch of
// exchange logs contains, and how far the cursor may move once some of them have been handled.

export interface ScanLog {
  transaction_hash: string;
  /** Consensus timestamp, "seconds.nanoseconds". */
  timestamp: string;
}

export type ScanOutcome = 'done' | 'declined' | 'retry';

/** Each transaction once, in consensus order, with the timestamp of its last log. */
export function transactionsIn(logs: ScanLog[]): { hash: string; timestamp: string }[] {
  const order: string[] = [];
  const last = new Map<string, string>();
  for (const log of logs) {
    if (!last.has(log.transaction_hash)) order.push(log.transaction_hash);
    last.set(log.transaction_hash, log.timestamp);
  }
  return order.map((hash) => ({ hash, timestamp: last.get(hash)! }));
}

/**
 * The cursor after handling transactions in order: it advances past every transaction that was done
 * or declined, and stops before the first one that should be retried, so the next run sees it again.
 */
export function advanceCursor(cursor: string, handled: { timestamp: string; outcome: ScanOutcome }[]): string {
  let next = cursor;
  for (const item of handled) {
    if (item.outcome === 'retry') break;
    next = item.timestamp;
  }
  return next;
}
