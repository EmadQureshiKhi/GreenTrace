'use client';

import { format } from 'date-fns';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { ConsensusProof } from '@/components/chain/consensus-proof';
import { ExplorerLink } from '@/components/chain/explorer-link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TestHbarButton } from '@/components/wallet/test-hbar-button';
import { WalletGate } from '@/components/wallet/wallet-gate';
import { useWalletStatus } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import {
  hbarToTinybar,
  orderTotalTinybar,
  stepStatuses,
  tinybarToHbar,
  usePurchase,
  walletErrorMessage,
  type PurchaseState,
  type StepStatus,
} from '@/hooks/use-marketplace';
import { toast } from '@/hooks/use-toast';
import { chainConfig } from '@/lib/chain-config';
import { errorMessage, formatHbar } from '@/lib/format';
import type { CarbonCredit, Order } from '@/lib/types';
import { cn } from '@/lib/utils';
import { associateCo2eToken, hasWallet } from '@/lib/wallet';
import { ListingImage } from './listing-image';

/** HBAR kept aside for network fees on top of the order total. */
const FEE_BUFFER_HBAR = 1;

export interface PurchaseTarget {
  /** Changes on every open so the flow starts fresh. */
  key: number;
  credit: CarbonCredit;
  quantity: number;
  /** An existing order to resume (pay or finish delivery). */
  order: Order | null;
}

interface PurchaseDialogProps {
  target: PurchaseTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseDialog({ target, open, onOpenChange }: PurchaseDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next && busy) return;
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg gap-5 overflow-y-auto rounded-lg p-5 sm:p-6',
          busy && '[&>button:last-child]:hidden',
        )}
        onInteractOutside={(event) => busy && event.preventDefault()}
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
      >
        <DialogHeader className="space-y-1 pr-8 text-left">
          <DialogTitle>Buy carbon credits</DialogTitle>
          <DialogDescription>Pay in HBAR from your wallet. The credits arrive as CO2e tokens on Hedera, 1 token per tonne.</DialogDescription>
        </DialogHeader>
        {target && (
          <>
            <ListingSummary credit={target.credit} />
            <WalletGate reason="buy carbon credits">
              <PurchaseFlow
                key={target.key}
                credit={target.credit}
                initialQuantity={target.quantity}
                initialOrder={target.order}
                onBusyChange={setBusy}
                onClose={() => onOpenChange(false)}
              />
            </WalletGate>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ListingSummary({ credit }: { credit: CarbonCredit }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md">
        <ListingImage key={credit.image_url ?? 'none'} src={credit.image_url} alt={credit.title} />
      </div>
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-semibold">{credit.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {credit.project_type} · {credit.location} · Vintage {credit.vintage}
        </p>
        <p className="text-xs font-medium text-primary">{formatHbar(Number(credit.price_hbar))} per tonne</p>
      </div>
    </div>
  );
}

function clampQuantity(value: number, max: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(Math.floor(value), Math.max(1, max));
}

interface PurchaseFlowProps {
  credit: CarbonCredit;
  initialQuantity: number;
  initialOrder: Order | null;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
}

function PurchaseFlow({ credit, initialQuantity, initialOrder, onBusyChange, onClose }: PurchaseFlowProps) {
  const { profile } = useAuth();
  const walletAddress = profile?.wallet_address ?? null;
  const wallet = useWalletStatus();
  const { state, busy, start, retryPayment, retryDelivery, reset } = usePurchase(walletAddress, initialOrder);
  const [quantityText, setQuantityText] = useState(() => String(clampQuantity(initialQuantity, credit.available)));
  const [associating, setAssociating] = useState(false);
  const [associated, setAssociated] = useState(false);

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
  useEffect(() => () => onBusyChange(false), [onBusyChange]);

  const max = credit.available;
  const quantity = state.order ? state.order.quantity : clampQuantity(Number.parseInt(quantityText, 10), max);
  const totalTinybar = state.order ? orderTotalTinybar(state.order) : hbarToTinybar(Number(credit.price_hbar)) * BigInt(quantity);
  const totalHbar = tinybarToHbar(totalTinybar);
  const unitPrice = state.order ? Number(state.order.unit_price_hbar) : Number(credit.price_hbar);
  const expired = state.phase === 'awaiting-payment' && state.order !== null && new Date(state.order.expires_at).getTime() < Date.now();

  const enableCo2e = async () => {
    if (!walletAddress) return;
    setAssociating(true);
    try {
      await associateCo2eToken(walletAddress);
      setAssociated(true);
      toast({ title: 'CO2e enabled', description: 'Your wallet can now receive CO2e tokens.' });
      await wallet.refetch();
    } catch (error) {
      toast({ title: 'Could not enable CO2e', description: walletErrorMessage(error), variant: 'destructive' });
    } finally {
      setAssociating(false);
    }
  };

  // ------------------------------------------------------------------ preconditions
  const blockers: { id: string; content: ReactNode; action?: ReactNode }[] = [];
  const w = wallet.data;
  if (!hasWallet()) {
    blockers.push({
      id: 'no-wallet',
      content: 'No browser wallet found. Install MetaMask to pay for credits.',
      action: (
        <Button asChild variant="outline" size="sm">
          <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">
            Install MetaMask <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        </Button>
      ),
    });
  }
  if (!chainConfig.exchangeContractAddress) {
    blockers.push({ id: 'no-contract', content: 'Purchases are not available yet: the exchange contract is not configured on this deployment.' });
  }
  if (w && !w.accountId) {
    blockers.push({
      id: 'no-account',
      content:
        chainConfig.network === 'mainnet'
          ? 'This wallet has no Hedera account yet. An account is created the first time the address receives HBAR. Send HBAR to it from an exchange or another wallet, then come back.'
          : 'This wallet has no Hedera account yet. An account is created the first time the address receives HBAR.',
      action: chainConfig.network === 'mainnet' ? undefined : <TestHbarButton />,
    });
  } else if (w) {
    if (w.hbar < totalHbar + FEE_BUFFER_HBAR) {
      blockers.push({
        id: 'low-balance',
        content: `You need about ${formatHbar(totalHbar + FEE_BUFFER_HBAR)} (the total plus about ${FEE_BUFFER_HBAR} HBAR for network fees). Your wallet has ${formatHbar(w.hbar)}.`,
        action: chainConfig.network === 'mainnet' ? undefined : <TestHbarButton />,
      });
    }
    if (!w.canReceiveCo2e && !associated) {
      blockers.push({
        id: 'not-associated',
        content: 'Your Hedera account cannot receive the CO2e token yet. Enable it once with a small transaction from your wallet.',
        action: (
          <Button size="sm" onClick={enableCo2e} disabled={associating}>
            {associating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
            Enable CO2e in my wallet
          </Button>
        ),
      });
    }
  }
  const walletReady = Boolean(w) && blockers.length === 0;
  const preparing = state.phase === 'configure' || state.phase === 'awaiting-payment';

  if (state.phase === 'done' && state.order) {
    return <SuccessView order={state.order} txHash={state.txHash} accountId={state.order.buyer_account_id ?? w?.accountId ?? null} onClose={onClose} />;
  }

  return (
    <div className="space-y-5">
      {state.phase === 'configure' ? (
        max <= 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>This listing is sold out.</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="purchase-quantity">Quantity (tonnes CO2e)</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Decrease quantity"
                onClick={() => setQuantityText(String(clampQuantity(quantity - 1, max)))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="purchase-quantity"
                inputMode="numeric"
                autoComplete="off"
                value={quantityText}
                onChange={(event) => setQuantityText(event.target.value.replace(/[^0-9]/g, '').slice(0, 7))}
                onBlur={() => setQuantityText(String(quantity))}
                className="w-24 text-center font-semibold tabular-nums"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Increase quantity"
                onClick={() => setQuantityText(String(clampQuantity(quantity + 1, max)))}
                disabled={quantity >= max}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <span className="ml-auto text-right text-xs text-muted-foreground">{max.toLocaleString()} t available</span>
            </div>
          </div>
        )
      ) : null}

      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
        <div className="min-w-0">
          <p className="text-sm font-medium">Total</p>
          <p className="text-xs text-muted-foreground">
            {quantity.toLocaleString()} t × {formatHbar(unitPrice)}
          </p>
        </div>
        <p className="text-right text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatHbar(totalHbar)}</p>
      </div>

      {state.phase !== 'configure' && <Steps state={state} />}

      {preparing && !expired && (
        <WalletPanel
          loading={wallet.isLoading}
          error={wallet.isError ? errorMessage(wallet.error) : null}
          refreshing={wallet.isFetching}
          onRetry={() => wallet.refetch()}
          accountId={w?.accountId ?? null}
          hbar={w?.hbar ?? null}
          co2e={w?.co2e ?? null}
          notFound={wallet.isSuccess && !w}
        />
      )}

      {preparing && !expired && blockers.length > 0 && (
        <div className="space-y-2">
          {blockers.map((b) => (
            <Alert key={b.id} className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 [&>svg]:text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>{b.content}</p>
                {b.action}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {state.issue && <IssueAlert state={state} />}

      {expired && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>This reservation has expired and the credits went back on sale. Start a new order to buy them.</AlertDescription>
        </Alert>
      )}

      <Actions
        state={state}
        expired={expired}
        canPay={walletReady && (state.phase !== 'configure' || max > 0)}
        totalHbar={totalHbar}
        onStart={() => start(credit.id, quantity)}
        onPay={retryPayment}
        onDeliver={retryDelivery}
        onReset={reset}
        onClose={onClose}
      />

      {busy && (
        <p className="text-center text-xs text-muted-foreground">Keep this window open until the credits are delivered.</p>
      )}
      {state.phase === 'configure' && (
        <p className="text-center text-xs text-muted-foreground">
          Reserving fixes the price and holds the credits for 30 minutes. Every purchase is logged on Hedera Consensus Service.
        </p>
      )}
    </div>
  );
}

function WalletPanel({
  loading,
  error,
  refreshing,
  onRetry,
  accountId,
  hbar,
  co2e,
  notFound,
}: {
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  onRetry: () => void;
  accountId: string | null;
  hbar: number | null;
  co2e: number | null;
  notFound: boolean;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium">
          <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Your wallet
        </span>
        {refreshing && !loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {loading ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking your wallet on Hedera...
        </p>
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-destructive">Could not read your wallet: {error}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : notFound ? (
        <p className="text-muted-foreground">No linked wallet was found for your account.</p>
      ) : (
        <dl className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Hedera account</dt>
            <dd className="min-w-0 text-right">
              {accountId ? <ExplorerLink kind="account" id={accountId} /> : <span className="text-muted-foreground">Not created yet</span>}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">HBAR balance</dt>
            <dd className="font-medium tabular-nums">{hbar === null ? '-' : formatHbar(hbar)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">CO2e balance</dt>
            <dd className="font-medium tabular-nums">{co2e === null ? '-' : `${co2e.toLocaleString()} t`}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

const STEP_TITLES = {
  reserve: 'Reserve order',
  pay: 'Pay in wallet',
  deliver: 'Deliver credits',
} as const;

function StepIcon({ status, index }: { status: StepStatus; index: number }) {
  const base = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold';
  if (status === 'done') return <span className={cn(base, 'bg-emerald-600 text-white')}><Check className="h-4 w-4" /></span>;
  if (status === 'active')
    return (
      <span className={cn(base, 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300')}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    );
  if (status === 'error') return <span className={cn(base, 'bg-red-600 text-white')}><X className="h-4 w-4" /></span>;
  if (status === 'info')
    return (
      <span className={cn(base, 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300')}>
        <Clock className="h-4 w-4" />
      </span>
    );
  return <span className={cn(base, 'border bg-background text-muted-foreground')}>{index + 1}</span>;
}

function Steps({ state }: { state: PurchaseState }) {
  const statuses = stepStatuses(state);
  const order = state.order;

  const detail: Record<keyof typeof STEP_TITLES, ReactNode> = {
    reserve:
      statuses.reserve === 'active'
        ? 'Fixing the price and holding the credits...'
        : order
          ? `Price fixed. Reserved until ${format(new Date(order.expires_at), 'HH:mm')}.`
          : 'Fixes the price and holds the credits for 30 minutes.',
    pay:
      statuses.pay === 'active' ? (
        'Confirm the payment in your wallet, then wait a few seconds for the network.'
      ) : state.txHash ? (
        <ExplorerLink kind="transaction" id={state.txHash} />
      ) : (
        'You send HBAR to the GreenTrace exchange contract from your own wallet.'
      ),
    deliver:
      statuses.deliver === 'active' ? (
        'Verifying the payment on Hedera and sending the CO2e tokens. This can take up to a minute.'
      ) : order?.delivery_tx_id ? (
        <ExplorerLink kind="transaction" id={order.delivery_tx_id} />
      ) : (
        'GreenTrace verifies the payment on the mirror node, then sends the CO2e tokens to your account.'
      ),
  };

  const keys = ['reserve', 'pay', 'deliver'] as const;
  return (
    <ol className="space-y-0">
      {keys.map((key, index) => {
        const status = statuses[key];
        return (
          <li key={key} className="relative flex gap-3 pb-4 last:pb-0">
            {index < keys.length - 1 && (
              <span
                aria-hidden
                className={cn('absolute left-[13px] top-8 h-[calc(100%-2.25rem)] w-px', status === 'done' ? 'bg-emerald-500' : 'bg-border')}
              />
            )}
            <StepIcon status={status} index={index} />
            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  'text-sm font-medium',
                  status === 'pending' && 'text-muted-foreground',
                  status === 'error' && 'text-destructive',
                )}
              >
                {STEP_TITLES[key]}
              </p>
              <div className="mt-0.5 text-xs text-muted-foreground">{detail[key]}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function IssueAlert({ state }: { state: PurchaseState }) {
  const issue = state.issue!;
  if (issue.tone === 'info') {
    return (
      <Alert className="border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100 [&>svg]:text-sky-600">
        <Clock className="h-4 w-4" />
        <AlertDescription>{issue.message}</AlertDescription>
      </Alert>
    );
  }
  const title =
    state.phase === 'configure' ? 'Could not reserve the order' : state.phase === 'awaiting-payment' ? 'Payment not completed' : 'Delivery not completed';
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="space-y-1.5">
        <p className="font-medium">{title}</p>
        <p className="break-words">{issue.message}</p>
        {state.phase === 'paid' && issue.retryable && (
          <p className="text-foreground/80">Your payment is safe on chain. Retrying delivery will not charge you again.</p>
        )}
        {issue.warning && <p className="font-medium text-amber-700 dark:text-amber-300">{issue.warning}</p>}
      </AlertDescription>
    </Alert>
  );
}

function Actions({
  state,
  expired,
  canPay,
  totalHbar,
  onStart,
  onPay,
  onDeliver,
  onReset,
  onClose,
}: {
  state: PurchaseState;
  expired: boolean;
  canPay: boolean;
  totalHbar: number;
  onStart: () => void;
  onPay: () => void;
  onDeliver: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const wide = 'w-full sm:w-auto';
  const row = 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end';

  switch (state.phase) {
    case 'configure':
      return (
        <Button className="w-full" size="lg" onClick={onStart} disabled={!canPay}>
          <Wallet className="mr-2 h-4 w-4" />
          {state.issue ? 'Try again' : `Reserve and pay ${formatHbar(totalHbar)}`}
        </Button>
      );
    case 'reserving':
    case 'paying':
    case 'delivering':
      return (
        <Button className="w-full" size="lg" disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {state.phase === 'reserving' ? 'Reserving...' : state.phase === 'paying' ? 'Waiting for your wallet...' : 'Delivering credits...'}
        </Button>
      );
    case 'awaiting-payment':
      if (expired) {
        return (
          <div className={row}>
            <Button variant="outline" className={wide} onClick={onClose}>
              Close
            </Button>
            <Button className={wide} onClick={onReset}>
              Start a new order
            </Button>
          </div>
        );
      }
      return (
        <Button className="w-full" size="lg" onClick={onPay} disabled={!canPay}>
          <Wallet className="mr-2 h-4 w-4" />
          {state.issue ? `Try payment again (${formatHbar(totalHbar)})` : `Pay ${formatHbar(totalHbar)}`}
        </Button>
      );
    case 'paid':
      if (state.issue && !state.issue.retryable) {
        return (
          <div className={row}>
            <Button variant="outline" className={wide} onClick={onClose}>
              Close
            </Button>
          </div>
        );
      }
      return (
        <div className={row}>
          <Button variant="outline" className={wide} onClick={onClose}>
            Close
          </Button>
          <Button className={wide} onClick={onDeliver}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {state.issue?.tone === 'info' ? 'Check again' : state.issue ? 'Retry delivery' : 'Deliver credits'}
          </Button>
        </div>
      );
    case 'done':
      return null;
  }
}

function SuccessView({ order, txHash, accountId, onClose }: { order: Order; txHash: string | null; accountId: string | null; onClose: () => void }) {
  const paymentTx = order.payment_tx_hash ?? txHash;
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold">{order.quantity.toLocaleString()} t CO2e delivered</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          The CO2e tokens are in your wallet{accountId ? ` (${accountId})` : ''}. Retire them against a certificate to offset your emissions.
        </p>
      </div>

      <dl className="space-y-2 rounded-lg border p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Paid</dt>
          <dd className="font-medium tabular-nums">{formatHbar(tinybarToHbar(orderTotalTinybar(order)))}</dd>
        </div>
        {paymentTx && (
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">Payment</dt>
            <dd className="min-w-0 text-right">
              <ExplorerLink kind="transaction" id={paymentTx} />
            </dd>
          </div>
        )}
        {order.delivery_tx_id && (
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">Delivery</dt>
            <dd className="min-w-0 text-right">
              <ExplorerLink kind="transaction" id={order.delivery_tx_id} />
            </dd>
          </div>
        )}
      </dl>

      <div className="flex justify-center">
        <ConsensusProof sequence={order.hcs_sequence} label="Purchase logged on Hedera" />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
          Done
        </Button>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/certificates">
            Retire against a certificate <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
