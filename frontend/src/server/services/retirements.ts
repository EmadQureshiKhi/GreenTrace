import 'server-only';
import * as z from 'zod';
import { chainConfig } from '@/lib/chain-config';
import type { Certificate, Profile, Retirement } from '@/lib/types';
import { anchor, wipeCredits } from '../hedera';
import { badRequest, forbidden, notFound } from '../http';
import { getTokenBalance } from '../mirror';
import { must, one, supabaseAdmin } from '../supabase-admin';
import { loadExchangeTransaction } from './exchange-events';
import { resolveAccountId, sameAccount } from './wallet';

export const retirementInput = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

/**
 * Completes a retirement the holder requested on chain. The request must come from the wallet linked
 * to the certificate owner's account. Idempotent per transaction hash.
 */
export async function processRetirement(txHash: string, expectedUserId?: string): Promise<Retirement> {
  const db = supabaseAdmin();
  const hash = txHash.toLowerCase();

  const { data: existing } = await db.from('retirements').select('*').eq('request_tx_hash', hash).maybeSingle<Retirement>();
  if (existing && (existing.status === 'completed' || existing.status === 'processing')) return existing;

  const { events } = await loadExchangeTransaction(hash);
  const request = events.find((e) => e.kind === 'retirement');
  if (!request || request.kind !== 'retirement') throw badRequest('This transaction is not a GreenTrace retirement request.');

  const certificate = must(
    await db.from('certificates').select('*').eq('certificate_id', request.certificateId).maybeSingle<Certificate>(),
    'Load certificate',
  );
  if (!certificate) throw notFound(`Certificate ${request.certificateId} does not exist.`);

  const owner = one(await db.from('profiles').select('*').eq('id', certificate.user_id).single<Profile>(), 'Load owner');
  if (!owner.wallet_address || !(await sameAccount(owner.wallet_address, request.retiree))) {
    throw forbidden('Only the certificate owner\'s linked wallet can retire credits against it.');
  }
  if (expectedUserId && owner.id !== expectedUserId) throw forbidden('This certificate belongs to another account.');
  if (request.amount > BigInt(Number.MAX_SAFE_INTEGER)) throw badRequest('Amount is too large.');
  const amount = Number(request.amount);

  const retirement =
    existing ??
    one(
      await db
        .from('retirements')
        .insert({
          user_id: owner.id,
          certificate_id: certificate.id,
          amount,
          request_tx_hash: hash,
          retiree_evm_address: request.retiree,
        })
        .select('*')
        .single<Retirement>(),
      'Record retirement',
    );

  // Claim the work so a concurrent caller (browser + listener) does not wipe twice.
  const { data: claimed } = await db
    .from('retirements')
    .update({ status: 'processing', error: null })
    .eq('id', retirement.id)
    .in('status', ['pending', 'failed'])
    .select('*')
    .maybeSingle<Retirement>();
  if (!claimed) return one(await db.from('retirements').select('*').eq('id', retirement.id).single<Retirement>(), 'Reload');

  try {
    const accountId = owner.hedera_account_id || (await resolveAccountId(request.retiree));
    if (!accountId) throw new Error('The wallet has no Hedera account.');
    const balance = await getTokenBalance(accountId, chainConfig.co2eTokenId);
    if (balance < amount) throw new Error(`The wallet holds ${balance} CO2e credits, fewer than the ${amount} requested.`);

    const wipeTxId = await wipeCredits(accountId, amount);
    const hcs = await anchor({
      type: 'CREDITS_RETIRED',
      certificateId: certificate.certificate_id,
      tonnes: amount,
      holder: accountId,
      requestTx: hash,
      retirementTx: wipeTxId,
    });
    must(await db.rpc('apply_retirement', { p_certificate_id: certificate.id, p_tonnes: amount }), 'Apply retirement');
    return one(
      await db
        .from('retirements')
        .update({
          status: 'completed',
          error: null,
          retiree_account_id: accountId,
          wipe_tx_id: wipeTxId,
          hcs_tx_id: hcs.txId,
          hcs_sequence: hcs.sequence,
          completed_at: new Date().toISOString(),
        })
        .eq('id', retirement.id)
        .select('*')
        .single<Retirement>(),
      'Complete retirement',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.from('retirements').update({ status: 'failed', error: message }).eq('id', retirement.id);
    throw badRequest(`Retirement could not be completed: ${message}`);
  }
}
