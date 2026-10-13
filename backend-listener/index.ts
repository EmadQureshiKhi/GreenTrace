/**
 * GreenTrace event listener.
 *
 * Watches the GreenTraceExchange contract on the Hedera mirror node and reports every transaction that
 * emitted an exchange event (a credit purchase or a retirement request) to the GreenTrace app. The app
 * verifies and completes it. This makes purchases and retirements finish even when the user closed the
 * browser before it reported them. The app's processing is idempotent, so replaying a transaction is
 * harmless, and this service keeps no state beyond an in-memory cursor.
 */
import 'dotenv/config';

interface Config {
  appUrl: string;
  secret: string;
  contractId: string;
  mirrorUrl: string;
  pollMs: number;
  lookbackSeconds: number;
}

function loadConfig(): Config {
  const required = (name: string) => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required (see .env.example)`);
    return value;
  };
  const network = process.env.HEDERA_NETWORK || 'testnet';
  return {
    appUrl: required('APP_URL').replace(/\/$/, ''),
    secret: required('INTERNAL_API_SECRET'),
    contractId: required('EXCHANGE_CONTRACT_ID'),
    mirrorUrl: process.env.MIRROR_NODE_URL || `https://${network}.mirrornode.hedera.com`,
    pollMs: Number(process.env.POLL_INTERVAL_MS || 5000),
    lookbackSeconds: Number(process.env.LOOKBACK_SECONDS || 3600),
  };
}

interface MirrorLog {
  transaction_hash: string;
  timestamp: string;
}

interface MirrorLogPage {
  logs: MirrorLog[];
  links: { next: string | null };
}

const log = (message: string, extra?: Record<string, unknown>) =>
  console.log(JSON.stringify({ at: new Date().toISOString(), message, ...extra }));

/** Fetches all logs after `cursor` (a consensus timestamp like "1761062400.123456789"), oldest first. */
async function logsSince(config: Config, cursor: string): Promise<MirrorLog[]> {
  const logs: MirrorLog[] = [];
  let path: string | null = `/api/v1/contracts/${config.contractId}/results/logs?order=asc&limit=100&timestamp=gt:${cursor}`;
  while (path) {
    const res = await fetch(`${config.mirrorUrl}${path}`);
    if (!res.ok) throw new Error(`Mirror node returned ${res.status}`);
    const page = (await res.json()) as MirrorLogPage;
    logs.push(...page.logs);
    path = page.links.next;
  }
  return logs;
}

type Outcome = 'done' | 'rejected' | 'retry';

/** Asks the app to verify and complete a transaction. 4xx means the app looked and declined: don't retry. */
async function reconcile(config: Config, txHash: string): Promise<Outcome> {
  try {
    const res = await fetch(`${config.appUrl}/api/internal/reconcile`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) {
      log('reconciled', { txHash, kind: body.kind });
      return 'done';
    }
    if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 429) {
      log('declined by app', { txHash, status: res.status, error: body.error });
      return 'rejected';
    }
    log('app error, will retry', { txHash, status: res.status, error: body.error });
    return 'retry';
  } catch (error) {
    log('app unreachable, will retry', { txHash, error: error instanceof Error ? error.message : String(error) });
    return 'retry';
  }
}

async function main() {
  const config = loadConfig();
  let cursor = `${Math.floor(Date.now() / 1000) - config.lookbackSeconds}.000000000`;
  log('listening', { contract: config.contractId, mirror: config.mirrorUrl, app: config.appUrl, from: cursor });

  let stopping = false;
  process.on('SIGTERM', () => (stopping = true));
  process.on('SIGINT', () => (stopping = true));

  while (!stopping) {
    try {
      const logs = await logsSince(config, cursor);
      // One transaction can emit several logs; report each transaction once, in consensus order.
      const seen = new Set<string>();
      for (const entry of logs) {
        if (!seen.has(entry.transaction_hash)) {
          seen.add(entry.transaction_hash);
          const outcome = await reconcile(config, entry.transaction_hash);
          if (outcome === 'retry') break; // keep the cursor here and try again next round
        }
        cursor = entry.timestamp;
      }
    } catch (error) {
      log('poll failed', { error: error instanceof Error ? error.message : String(error) });
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollMs));
  }
  log('stopped');
}

main().catch((error) => {
  log('fatal', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
