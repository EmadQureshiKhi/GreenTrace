'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, Check, CheckCircle, Clock, Copy, ExternalLink, Hash, Loader2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { shortHash } from '@/lib/format';
import { cn } from '@/lib/utils';

/** The latest consensus-log write for one area of the app, as tracked by the UI. */
export interface SemaTransaction {
  status: 'success' | 'pending' | 'error';
  /** Machine name of the logged action, e.g. "stakeholder_added". */
  action: string;
  message: string;
  timestamp: string;
  txId?: string;
  /** Sequence number of the message on the consensus topic. */
  sequence?: number;
  /** Link to the message (or transaction) on HashScan. */
  hashScanUrl?: string;
  /** SHA-256 of the logged payload, computed by the server. */
  dataHash?: string;
  error?: string;
}

interface HcsTransactionDisplayProps {
  transaction: SemaTransaction | null;
  title?: string;
  description?: string;
  className?: string;
}

const STATUS_STYLES: Record<SemaTransaction['status'], { card: string; badge: string; label: string }> = {
  success: {
    card: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/40',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    label: 'Anchored',
  },
  pending: {
    card: 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/40',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    label: 'Pending',
  },
  error: {
    card: 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/40',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    label: 'Not logged',
  },
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      aria-label={`Copy ${label}`}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

/** Shows the latest Hedera Consensus Service log entry for a section: pending, anchored or failed. */
export function HcsTransactionDisplay({
  transaction,
  title = 'Hedera audit log',
  description = 'Each change is hashed and the hash is logged to Hedera Consensus Service.',
  className,
}: HcsTransactionDisplayProps) {
  if (!transaction) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="flex items-start gap-3 py-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">Nothing logged in this session yet. Saved changes are logged to Hedera automatically.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const style = STATUS_STYLES[transaction.status];
  const StatusIcon = transaction.status === 'success' ? CheckCircle : transaction.status === 'error' ? AlertCircle : Clock;

  return (
    <Card className={cn(style.card, className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {transaction.status === 'pending' ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-600" />
            ) : (
              <StatusIcon
                className={cn('h-5 w-5 shrink-0', transaction.status === 'success' ? 'text-emerald-600' : 'text-red-600')}
              />
            )}
            <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
          </div>
          <Badge className={cn('border-transparent', style.badge)}>{style.label}</Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {transaction.status === 'error' && transaction.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The change was saved, but logging it to Hedera failed: {transaction.error}
            </AlertDescription>
          </Alert>
        )}

        {(transaction.txId || transaction.dataHash) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {transaction.txId && (
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {transaction.sequence ? `Topic message #${transaction.sequence}` : 'Transaction'}
                </p>
                <div className="flex items-center gap-1">
                  <code className="min-w-0 flex-1 truncate rounded bg-background/70 px-2 py-1 font-mono text-xs" title={transaction.txId}>
                    {transaction.txId}
                  </code>
                  <CopyButton value={transaction.txId} label="transaction ID" />
                  {transaction.hashScanUrl && (
                    <Button variant="ghost" size="icon" asChild className="h-7 w-7 shrink-0">
                      <a href={transaction.hashScanUrl} target="_blank" rel="noopener noreferrer" aria-label="View on HashScan">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
            {transaction.dataHash && (
              <div className="min-w-0 space-y-1.5">
                <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Hash className="h-3 w-3" /> Data hash (SHA-256)
                </p>
                <div className="flex items-center gap-1">
                  <code className="min-w-0 flex-1 truncate rounded bg-background/70 px-2 py-1 font-mono text-xs" title={transaction.dataHash}>
                    {shortHash(transaction.dataHash, 14, 8)}
                  </code>
                  <CopyButton value={transaction.dataHash} label="data hash" />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Action</p>
            <p className="break-words font-mono text-xs font-medium">{transaction.action}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Time</p>
            <p className="font-medium">{format(new Date(transaction.timestamp), 'PPP p')}</p>
          </div>
        </div>

        <p className="border-t pt-3 text-sm text-muted-foreground">{transaction.message}</p>
      </CardContent>
    </Card>
  );
}
