import * as z from 'zod';
import { requireInternal } from '@/server/auth';
import { serverEnv } from '@/server/env';
import { readJson, route } from '@/server/http';
import { reconcileExchangeTransaction } from '@/server/services/reconcile';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const input = z.object({ txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) });

// For an optional self-hosted listener (backend-listener/) that reports exchange transactions within
// seconds; the scheduled scan (/api/internal/scan) does the same every minute without one.
export const POST = route(async (req) => {
  requireInternal(req, serverEnv.internalApiSecret());
  const { txHash } = input.parse(await readJson(req));
  return reconcileExchangeTransaction(txHash);
});
