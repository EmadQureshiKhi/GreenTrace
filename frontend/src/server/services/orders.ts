import 'server-only';
import { hexlify } from 'ethers';
import * as z from 'zod';
import { TINYBAR_PER_HBAR } from '@/lib/chain-config';
import type { CarbonCredit, Order } from '@/lib/types';
import type { RequestUser } from '../auth';
import { anchor, deliverCredits } from '../hedera';
import { badRequest, conflict, forbidden, notFound } from '../http';
import { must, one, supabaseAdmin } from '../supabase-admin';
import { loadExchangeTransaction } from './exchange-events';
import { resolveAccountId, sameAccount } from './wallet';

const ORDER_TTL_MS = 30 * 60 * 1000;
const DELIVERY_LEASE_MS = 5 * 60 * 1000;

export const createOrderInput = z.object({
  creditId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10_000),
});

export const confirmOrderInput = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

/** Converts an HBAR price to tinybar exactly (prices have at most 8 decimals). */
export function hbarToTinybar(hbar: number): bigint {
  const [whole, fraction = ''] = hbar.toFixed(8).split('.');
  return BigInt(whole) * TINYBAR_PER_HBAR + BigInt(fraction.padEnd(8, '0'));
}

/** Expires unpaid orders past their deadline and puts their credits back on sale. */
export async function expireStaleOrders(): Promise<void> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('orders')
    .update({ status: 'expired' })
    .eq('status', 'awaiting_payment')
    .lt('expires_at', new Date().toISOString())
    .select('credit_id, quantity');
  for (const order of data ?? []) {
    await db.rpc('release_credits', { p_credit_id: order.credit_id, p_quantity: order.quantity });
  }
}

export async function createOrder(user: RequestUser & { wallet: string }, input: z.infer<typeof createOrderInput>): Promise<Order> {
  const db = supabaseAdmin();
  await expireStaleOrders();

  const credit = must(
    await db.from('carbon_credits').select('*').eq('id', input.creditId).maybeSingle<CarbonCredit>(),
    'Load listing',
  );
  if (!credit) throw notFound('Listing not found.');

  const reserved = must(
    await db.rpc('reserve_credits', { p_credit_id: credit.id, p_quantity: input.quantity }),
    'Reserve credits',
  );
  if (!reserved) throw conflict(`Only ${credit.available} credits are available.`);

  const total = hbarToTinybar(Number(credit.price_hbar)) * BigInt(input.quantity);
  const orderRef = hexlify(crypto.getRandomValues(new Uint8Array(32)));

  const { data, error } = await db
    .from('orders')
    .insert({
      user_id: user.id,
      credit_id: credit.id,
      quantity: input.quantity,
      unit_price_hbar: credit.price_hbar,
      total_tinybar: total.toString(),
      order_ref: orderRef,
      buyer_evm_address: user.wallet,
      buyer_account_id: user.profile.hedera_account_id,
      expires_at: new Date(Date.now() + ORDER_TTL_MS).toISOString(),
    })
    .select('*')
    .single<Order>();
  if (error || !data) {
    await db.rpc('release_credits', { p_credit_id: credit.id, p_quantity: input.quantity });
    throw new Error(`Create order: ${error?.message ?? 'no row returned'}`);
  }
  return data;
}

/**
 * Verifies a purchase payment and delivers the credits. Idempotent and safe to call concurrently
 * (the buyer's browser and the backend listener may both report the same payment): only the caller
 * that moves the order out of `awaiting_payment` performs the delivery.
 */
export async function fulfilPurchase(txHash: string, expectedUserId?: string): Promise<Order> {
  const db = supabaseAdmin();
  const { events } = await loadExchangeTransaction(txHash);
  const payment = events.find((e) => e.kind === 'purchase');
  if (!payment || payment.kind !== 'purchase') throw badRequest('This transaction is not a GreenTrace purchase.');

  const order = must(
    await db.from('orders').select('*').eq('order_ref', payment.orderRef).maybeSingle<Order>(),
    'Load order',
  );
  if (!order) throw notFound('No order matches this payment.');
  if (expectedUserId && order.user_id !== expectedUserId) throw forbidden('This order belongs to another account.');
  const hash = txHash.toLowerCase();
  if (order.status === 'fulfilled') return order;
  // `paid` means another caller is delivering. If that caller died mid-delivery (no delivery after
  // the lease), the order can be claimed again.
  const stalled = order.status === 'paid' && !order.delivery_tx_id && Date.parse(order.updated_at) < Date.now() - DELIVERY_LEASE_MS;
  if (order.status === 'paid' && !stalled) return order;
  if (order.payment_tx_hash && order.payment_tx_hash !== hash) throw conflict('This order was paid by another transaction.');
  // A paid order whose token delivery failed can be retried; any other failure is final.
  const retryDelivery = order.status === 'failed' && order.payment_tx_hash === hash && Boolean(order.error?.startsWith('Delivery failed'));
  if (order.status === 'failed' && !retryDelivery) return order;
  if (!(await sameAccount(payment.buyer, order.buyer_evm_address))) throw badRequest('The payment came from a different wallet than the order.');
  if (payment.amountPaidTinybar < BigInt(order.total_tinybar)) throw badRequest('The payment is less than the order total.');

  // A payment that arrives after the order expired is still honoured if the stock is there.
  if (order.status === 'expired') {
    const reserved = must(await db.rpc('reserve_credits', { p_credit_id: order.credit_id, p_quantity: order.quantity }), 'Reserve');
    if (!reserved) {
      await db.from('orders').update({ status: 'failed', payment_tx_hash: hash, error: 'Paid after expiry and the listing sold out. Refund required.' }).eq('id', order.id);
      throw conflict('The order expired and the listing sold out before payment arrived.');
    }
  }

  const { data: claimed } = await db
    .from('orders')
    .update({ status: 'paid', payment_tx_hash: hash })
    .eq('id', order.id)
    .in('status', retryDelivery ? ['failed'] : stalled ? ['paid'] : ['awaiting_payment', 'expired'])
    .select('*')
    .maybeSingle<Order>();
  if (!claimed) {
    return one(await db.from('orders').select('*').eq('id', order.id).single<Order>(), 'Reload order');
  }

  try {
    const accountId = claimed.buyer_account_id || (await resolveAccountId(claimed.buyer_evm_address));
    if (!accountId) throw new Error('The buyer wallet has no Hedera account.');
    const deliveryTxId = await deliverCredits(accountId, claimed.quantity);
    const hcs = await anchor({
      type: 'CREDITS_PURCHASED',
      order: claimed.id,
      credit: claimed.credit_id,
      tonnes: claimed.quantity,
      buyer: accountId,
      paymentTx: hash,
      deliveryTx: deliveryTxId,
    });
    return one(
      await db
        .from('orders')
        .update({ status: 'fulfilled', buyer_account_id: accountId, delivery_tx_id: deliveryTxId, hcs_tx_id: hcs.txId, hcs_sequence: hcs.sequence, error: null })
        .eq('id', claimed.id)
        .select('*')
        .single<Order>(),
      'Complete order',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.from('orders').update({ status: 'failed', error: `Delivery failed: ${message}` }).eq('id', claimed.id);
    throw new Error(`Payment received but delivery failed: ${message}`);
  }
}
