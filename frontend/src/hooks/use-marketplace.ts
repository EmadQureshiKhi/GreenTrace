'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useConfirmOrder, useCreateOrder, useCreditRatings, useCredits } from '@/hooks/use-api';
import { TINYBAR_PER_HBAR } from '@/lib/chain-config';
import { errorMessage } from '@/lib/format';
import type { CarbonCredit, CreditRating, Order } from '@/lib/types';
import { payForOrder, WalletError } from '@/lib/wallet';

// Marketplace helpers: listing stats, search/sort, and the reserve -> pay -> deliver purchase flow.

// --------------------------------------------------------------------------- money

/** Converts an HBAR price to tinybar exactly, the same way the server prices an order. */
export function hbarToTinybar(hbar: number): bigint {
  const [whole, fraction = ''] = Number(hbar).toFixed(8).split('.');
  return BigInt(whole) * TINYBAR_PER_HBAR + BigInt(fraction.padEnd(8, '0'));
}

/** Tinybar (bigint, or the number/string the database returns) to HBAR for display. */
export function tinybarToHbar(tinybar: bigint | number | string): number {
  const value = typeof tinybar === 'bigint' ? tinybar : BigInt(String(tinybar));
  return Number(value / TINYBAR_PER_HBAR) + Number(value % TINYBAR_PER_HBAR) / Number(TINYBAR_PER_HBAR);
}

export function orderTotalTinybar(order: Pick<Order, 'total_tinybar'>): bigint {
  return BigInt(String(order.total_tinybar));
}

// --------------------------------------------------------------------------- listings

/** Listings store a free-text location; the country is its last comma-separated part. */
export function countryOf(location: string): string {
  const parts = location.split(',').map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? location.trim();
}

export interface MarketStats {
  projects: number;
  availableTonnes: number;
  averagePriceHbar: number | null;
  countries: number;
}

export function marketStats(credits: CarbonCredit[]): MarketStats {
  const prices = credits.map((c) => Number(c.price_hbar));
  return {
    projects: credits.length,
    availableTonnes: credits.reduce((sum, c) => sum + c.available, 0),
    averagePriceHbar: prices.length ? prices.reduce((sum, p) => sum + p, 0) / prices.length : null,
    countries: new Set(credits.map((c) => countryOf(c.location).toLowerCase())).size,
  };
}

export type SortKey = 'price-asc' | 'price-desc' | 'rating' | 'availability';

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'AI rating' },
  { value: 'availability', label: 'Most available' },
];

export interface ListingFilters {
  query: string;
  projectType: string;
  sort: SortKey;
}

export function filterListings(credits: CarbonCredit[], ratings: Map<string, CreditRating>, filters: ListingFilters): CarbonCredit[] {
  const terms = filters.query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = credits.filter((c) => {
    if (filters.projectType !== 'all' && c.project_type !== filters.projectType) return false;
    if (!terms.length) return true;
    const haystack = [c.title, c.description, c.location, c.project_type, c.methodology, c.registry, c.vintage]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });

  const price = (c: CarbonCredit) => Number(c.price_hbar);
  const score = (c: CarbonCredit) => ratings.get(c.id)?.overall_score ?? -1;
  const compare: Record<SortKey, (a: CarbonCredit, b: CarbonCredit) => number> = {
    'price-asc': (a, b) => price(a) - price(b),
    'price-desc': (a, b) => price(b) - price(a),
    rating: (a, b) => score(b) - score(a) || price(a) - price(b),
    availability: (a, b) => b.available - a.available,
  };
  return [...matches].sort((a, b) => compare[filters.sort](a, b) || a.title.localeCompare(b.title));
}

/** Listings, their AI ratings by credit id, and the project types present in the data. */
export function useMarketplaceData() {
  const credits = useCredits();
  const ratings = useCreditRatings();
  const ratingsById = useMemo(() => new Map((ratings.data ?? []).map((r) => [r.credit_id, r])), [ratings.data]);
  const creditsById = useMemo(() => new Map((credits.data ?? []).map((c) => [c.id, c])), [credits.data]);
  const projectTypes = useMemo(
    () => Array.from(new Set((credits.data ?? []).map((c) => c.project_type))).sort((a, b) => a.localeCompare(b)),
    [credits.data],
  );
  return { credits, ratings, ratingsById, creditsById, projectTypes };
}

// --------------------------------------------------------------------------- payment memory

// The payment hash is remembered in the browser between paying and delivery, so a closed tab or a
// failed delivery can still be completed later from "My orders".
const paymentKey = (orderId: string) => `greentrace:order-payment:${orderId}`;

export function rememberedPayment(orderId: string): string | null {
  try {
    return window.localStorage.getItem(paymentKey(orderId));
  } catch {
    return null;
  }
}

function rememberPayment(orderId: string, txHash: string) {
  try {
    window.localStorage.setItem(paymentKey(orderId), txHash);
  } catch {
    // Storage can be unavailable (private mode); the flow still works while the dialog is open.
  }
}

export function forgetPayment(orderId: string) {
  try {
    window.localStorage.removeItem(paymentKey(orderId));
  } catch {
    // ignore
  }
}

/** Ethers errors carry a long technical message; prefer its short form. */
export function walletErrorMessage(error: unknown): string {
  const short = (error as { shortMessage?: unknown })?.shortMessage;
  const code = (error as { code?: unknown })?.code;
  if (code === 'INSUFFICIENT_FUNDS') return 'Your wallet does not have enough HBAR for this payment and its network fee.';
  if (typeof short === 'string' && short) return short;
  return errorMessage(error);
}

// --------------------------------------------------------------------------- purchase flow

export type PurchasePhase = 'configure' | 'reserving' | 'awaiting-payment' | 'paying' | 'paid' | 'delivering' | 'done';

export interface PurchaseIssue {
  message: string;
  /** Extra caution, e.g. when a payment may have been sent even though the wallet reported an error. */
  warning?: string;
  /** 'info' when nothing is wrong but the step is not finished yet. */
  tone: 'error' | 'info';
  /** False when retrying cannot help (the order failed for good). */
  retryable: boolean;
}

export interface PurchaseState {
  phase: PurchasePhase;
  order: Order | null;
  txHash: string | null;
  issue: PurchaseIssue | null;
}

function initialState(order: Order | null): PurchaseState {
  if (!order) return { phase: 'configure', order: null, txHash: null, issue: null };
  const txHash = order.payment_tx_hash ?? rememberedPayment(order.id);
  if (order.status === 'fulfilled') return { phase: 'done', order, txHash, issue: null };
  if (txHash) return { phase: 'paid', order, txHash, issue: null };
  return { phase: 'awaiting-payment', order, txHash: null, issue: null };
}

export type StepStatus = 'pending' | 'active' | 'done' | 'error' | 'info';

export function stepStatuses(state: PurchaseState): { reserve: StepStatus; pay: StepStatus; deliver: StepStatus } {
  const issue = state.issue ? (state.issue.tone === 'info' ? 'info' : 'error') : null;
  switch (state.phase) {
    case 'configure':
      return { reserve: issue ?? 'pending', pay: 'pending', deliver: 'pending' };
    case 'reserving':
      return { reserve: 'active', pay: 'pending', deliver: 'pending' };
    case 'awaiting-payment':
      return { reserve: 'done', pay: issue ?? 'pending', deliver: 'pending' };
    case 'paying':
      return { reserve: 'done', pay: 'active', deliver: 'pending' };
    case 'paid':
      return { reserve: 'done', pay: 'done', deliver: issue ?? 'pending' };
    case 'delivering':
      return { reserve: 'done', pay: 'done', deliver: 'active' };
    case 'done':
      return { reserve: 'done', pay: 'done', deliver: 'done' };
  }
}

/**
 * Drives one purchase: reserve an order (server fixes the price and holds the stock), pay it from the
 * linked wallet through the exchange contract, then ask the server to verify the payment and deliver.
 */
export function usePurchase(walletAddress: string | null, initialOrder: Order | null) {
  const queryClient = useQueryClient();
  const { mutateAsync: createOrder } = useCreateOrder();
  const { mutateAsync: confirmOrder } = useConfirmOrder();
  const [state, setState] = useState<PurchaseState>(() => initialState(initialOrder));

  const deliver = useCallback(
    async (order: Order, txHash: string) => {
      setState({ phase: 'delivering', order, txHash, issue: null });
      try {
        const result = await confirmOrder({ orderId: order.id, txHash });
        if (result.status === 'fulfilled') {
          forgetPayment(order.id);
          setState({ phase: 'done', order: result, txHash, issue: null });
          return;
        }
        let issue: PurchaseIssue;
        if (result.status === 'paid') {
          issue = { tone: 'info', retryable: true, message: 'Payment confirmed. The credits are being delivered right now; check again in a moment.' };
        } else if (result.status === 'failed') {
          const deliveryFailed = Boolean(result.error?.startsWith('Delivery failed'));
          if (!deliveryFailed) forgetPayment(order.id);
          issue = { tone: 'error', retryable: deliveryFailed, message: result.error ?? 'The order failed.' };
        } else {
          issue = { tone: 'error', retryable: true, message: 'The payment has not been matched to this order yet. Try again in a few seconds.' };
        }
        setState({ phase: 'paid', order: result, txHash, issue });
      } catch (error) {
        setState({ phase: 'paid', order, txHash, issue: { tone: 'error', retryable: true, message: errorMessage(error) } });
      }
    },
    [confirmOrder],
  );

  const pay = useCallback(
    async (order: Order) => {
      if (!walletAddress) {
        setState((s) => ({ ...s, issue: { tone: 'error', retryable: false, message: 'Link a wallet to pay.' } }));
        return;
      }
      setState({ phase: 'paying', order, txHash: null, issue: null });
      let txHash: string;
      try {
        txHash = await payForOrder(walletAddress, order.order_ref, orderTotalTinybar(order));
      } catch (error) {
        // A WalletError means nothing was sent (cancelled, wrong network or account, reverted). Anything
        // else may have happened after the transaction was broadcast.
        const maybeSent = !(error instanceof WalletError);
        setState({
          phase: 'awaiting-payment',
          order,
          txHash: null,
          issue: {
            tone: 'error',
            retryable: true,
            message: walletErrorMessage(error),
            warning: maybeSent
              ? 'Check the activity tab in your wallet before paying again. If this payment was sent, do not pay a second time.'
              : undefined,
          },
        });
        return;
      }
      rememberPayment(order.id, txHash);
      await deliver(order, txHash);
    },
    [walletAddress, deliver],
  );

  const start = useCallback(
    async (creditId: string, quantity: number) => {
      setState({ phase: 'reserving', order: null, txHash: null, issue: null });
      let order: Order;
      try {
        order = await createOrder({ creditId, quantity });
      } catch (error) {
        setState({ phase: 'configure', order: null, txHash: null, issue: { tone: 'error', retryable: true, message: errorMessage(error) } });
        return;
      } finally {
        queryClient.invalidateQueries({ queryKey: ['credits'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      }
      await pay(order);
    },
    [createOrder, pay, queryClient],
  );

  const retryPayment = useCallback(() => {
    if (state.order) void pay(state.order);
  }, [pay, state.order]);

  const retryDelivery = useCallback(() => {
    if (state.order && state.txHash) void deliver(state.order, state.txHash);
  }, [deliver, state.order, state.txHash]);

  const reset = useCallback(() => setState({ phase: 'configure', order: null, txHash: null, issue: null }), []);

  const busy = state.phase === 'reserving' || state.phase === 'paying' || state.phase === 'delivering';
  return { state, busy, start, retryPayment, retryDelivery, reset };
}
