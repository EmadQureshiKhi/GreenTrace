import 'server-only';
import * as z from 'zod';
import { hashCanonical } from '@/lib/hashing';
import type { HcsAnchor } from '@/lib/types';
import type { RequestUser } from '../auth';
import { anchor } from '../hedera';
import { notFound } from '../http';
import { supabaseAdmin } from '../supabase-admin';

export const semaAnchorInput = z.object({
  clientId: z.string().uuid(),
  action: z.string().regex(/^[a-z_]{3,64}$/),
  payload: z.record(z.unknown()),
});

/** Logs a SEMA change to the consensus topic: the action and a hash of its data (not the data itself). */
export async function anchorSemaAction(user: RequestUser, input: z.infer<typeof semaAnchorInput>): Promise<HcsAnchor & { dataHash: string }> {
  const { data: client } = await supabaseAdmin().from('sema_clients').select('id').eq('id', input.clientId).eq('user_id', user.id).maybeSingle();
  if (!client) throw notFound('Organization not found.');
  const dataHash = await hashCanonical(input.payload);
  const hcs = await anchor({ type: 'SEMA_ACTION', action: input.action, client: input.clientId, dataHash });
  return { ...hcs, dataHash };
}
