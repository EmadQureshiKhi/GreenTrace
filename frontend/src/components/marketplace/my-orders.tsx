'use client';

import { format } from 'date-fns';
import { AlertCircle, Loader2, Package, RefreshCw, Wallet } from 'lucide-react';
import { ConsensusProof } from '@/components/chain/consensus-proof';
import { ExplorerLink } from '@/components/chain/explorer-link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirmOrder, useOrders } from '@/hooks/use-api';
import { forgetPayment, orderTotalTinybar, rememberedPayment, tinybarToHbar } from '@/hooks/use-marketplace';
import { toast } from '@/hooks/use-toast';
import { errorMessage, formatHbar } from '@/lib/format';
import type { CarbonCredit, Order, OrderStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS: Record<OrderStatus, { label: string; className: string }> = {
  awaiting_payment: {
    label: 'Awaiting payment',
    className: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  },
  paid: {
    label: 'Paid, delivering',
    className: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200',
  },
  fulfilled: {
    label: 'Delivered',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  },
  failed: {
    label: 'Failed',
    className: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
  },
  expired: {
    label: 'Expired',
    className: 'border-border bg-muted text-muted-foreground',
  },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS[status];
  return <span className={cn('inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', s.className)}>{s.label}</span>;
}

interface MyOrdersProps {
  creditsById: Map<string, CarbonCredit>;
  /** Opens the purchase dialog on an existing order (pay a reservation or finish a delivery). */
  onResume: (order: Order, credit: CarbonCredit) => void;
}

export function MyOrders({ creditsById, onResume }: MyOrdersProps) {
  const orders = useOrders();
  const now = Date.now();

  const visible = (orders.data ?? []).filter(
    (o) => !(o.status === 'awaiting_payment' && new Date(o.expires_at).getTime() < now && !rememberedPayment(o.id)),
  );

  return (
    <Card id="orders" className="scroll-mt-20">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            My orders
          </CardTitle>
          <CardDescription>Credits you bought, with the payment, delivery and consensus records behind each one.</CardDescription>
        </div>
        {orders.isFetching && !orders.isLoading && <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        {orders.isLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="animate-pulse space-y-2 rounded-lg border p-4">
                <div className="h-4 w-1/2 rounded bg-muted" />
                <div className="h-3 w-1/3 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : orders.isError ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Could not load your orders: {errorMessage(orders.error)}
            </p>
            <Button variant="outline" size="sm" onClick={() => orders.refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <Package className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No orders yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">Credits you buy appear here, ready to retire against a certificate.</p>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {visible.map((order) => (
              <OrderRow key={order.id} order={order} credit={creditsById.get(order.credit_id)} now={now} onResume={onResume} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function OrderRow({
  order,
  credit,
  now,
  onResume,
}: {
  order: Order;
  credit: CarbonCredit | undefined;
  now: number;
  onResume: (order: Order, credit: CarbonCredit) => void;
}) {
  const confirm = useConfirmOrder();
  const storedHash = order.status === 'awaiting_payment' ? rememberedPayment(order.id) : null;
  const paymentTx = order.payment_tx_hash ?? storedHash;
  const deliveryRetryable = order.status === 'failed' && Boolean(order.payment_tx_hash) && Boolean(order.error?.startsWith('Delivery failed'));
  const unpaidOpen = order.status === 'awaiting_payment' && !storedHash && new Date(order.expires_at).getTime() >= now;
  const minutesLeft = Math.max(1, Math.ceil((new Date(order.expires_at).getTime() - now) / 60_000));

  const finishDelivery = () => {
    const txHash = paymentTx;
    if (!txHash) return;
    confirm.mutate(
      { orderId: order.id, txHash },
      {
        onSuccess: (result) => {
          if (result.status === 'fulfilled') {
            forgetPayment(order.id);
            toast({ title: 'Credits delivered', description: `${result.quantity.toLocaleString()} t CO2e are in your wallet.` });
          } else if (result.status === 'failed') {
            toast({ title: 'Delivery failed', description: result.error ?? 'The order failed.', variant: 'destructive' });
          } else {
            toast({ title: 'Still processing', description: 'The payment is confirmed and delivery is in progress. Check again in a moment.' });
          }
        },
        onError: (error) => toast({ title: 'Delivery failed', description: errorMessage(error), variant: 'destructive' }),
      },
    );
  };

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 font-medium">{credit?.title ?? 'Listing no longer available'}</p>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{order.quantity.toLocaleString()} t</span>
          {' · '}
          <span className="tabular-nums">{formatHbar(tinybarToHbar(orderTotalTinybar(order)))}</span>
          {' · '}
          {format(new Date(order.created_at), 'd MMM yyyy, HH:mm')}
        </p>
        {(paymentTx || order.delivery_tx_id) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {paymentTx && (
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="text-muted-foreground">Payment</span>
                <ExplorerLink kind="transaction" id={paymentTx} />
              </span>
            )}
            {order.delivery_tx_id && (
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="text-muted-foreground">Delivery</span>
                <ExplorerLink kind="transaction" id={order.delivery_tx_id} />
              </span>
            )}
          </div>
        )}
        <ConsensusProof sequence={order.hcs_sequence} label="Purchase logged on Hedera" />
        {order.status === 'failed' && order.error && <p className="break-words text-sm text-destructive">{order.error}</p>}
        {unpaidOpen && <p className="text-xs text-muted-foreground">Reserved for {minutesLeft} more minute{minutesLeft === 1 ? '' : 's'}.</p>}
        {storedHash && <p className="text-xs text-muted-foreground">Payment sent from this browser. Finish the delivery to receive the credits.</p>}
      </div>

      {(deliveryRetryable || storedHash || order.status === 'paid') && (
        <Button variant="outline" size="sm" className="shrink-0 self-start" onClick={finishDelivery} disabled={confirm.isPending || !paymentTx}>
          {confirm.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          {order.status === 'paid' ? 'Check delivery' : 'Retry delivery'}
        </Button>
      )}
      {unpaidOpen && credit && (
        <Button size="sm" className="shrink-0 self-start" onClick={() => onResume(order, credit)}>
          <Wallet className="mr-1.5 h-3.5 w-3.5" /> Complete payment
        </Button>
      )}
    </li>
  );
}
