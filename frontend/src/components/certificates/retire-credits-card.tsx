'use client';

import { AlertCircle, CheckCircle2, Circle, Flame, Loader2, RefreshCw, ShoppingCart, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { ConsensusProof } from '@/components/chain/consensus-proof';
import { ExplorerLink } from '@/components/chain/explorer-link';
import { WalletGate } from '@/components/wallet/wallet-gate';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWalletStatus } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { useRetirementFlow, type RetirementPhase } from '@/hooks/use-certificates';
import { toast } from '@/hooks/use-toast';
import { errorMessage, shortHash } from '@/lib/format';
import type { Certificate, Retirement } from '@/lib/types';
import { cn } from '@/lib/utils';

export function RetireCreditsCard({ certificate, remaining }: { certificate: Certificate; remaining: number }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Flame className="h-5 w-5 text-primary" /> Retire credits
        </CardTitle>
        <CardDescription>
          Burn CO2e credits from your wallet against this certificate. Each credit is one tonne, and the retirement is logged on Hedera.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <WalletGate reason="retire credits">
          <RetireForm certificate={certificate} remaining={remaining} />
        </WalletGate>
      </CardContent>
    </Card>
  );
}

function RetireForm({ certificate, remaining }: { certificate: Certificate; remaining: number }) {
  const { profile } = useAuth();
  const wallet = useWalletStatus();
  const flow = useRetirementFlow();
  const balance = Math.floor(wallet.data?.co2e ?? 0);
  const max = Math.min(balance, remaining);
  const [amount, setAmount] = useState('');

  // Default to the most the user can retire; follow the cap when the balance or remaining tonnes change.
  useEffect(() => {
    if (max > 0) setAmount((current) => (current === '' || Number(current) > max ? String(max) : current));
  }, [max]);

  const tonnes = Number(amount);
  const valid = Number.isInteger(tonnes) && tonnes >= 1 && tonnes <= max;
  const address = profile?.wallet_address;

  const announce = (retirement: Retirement | null) => {
    if (!retirement) return;
    const tonnesText = `${Number(retirement.amount).toLocaleString()} t CO2e`;
    toast(
      retirement.status === 'completed'
        ? { title: 'Credits retired', description: `${tonnesText} retired against ${certificate.certificate_id}.` }
        : { title: 'Retirement in progress', description: `${tonnesText} is being retired. The history updates when it completes.` },
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!address || !valid || flow.busy) return;
    announce(await flow.start(address, tonnes, certificate.certificate_id));
  };

  const retry = async () => announce(await flow.retryRecording());

  if (wallet.isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Reading your wallet balance...
      </div>
    );
  }

  if (wallet.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Could not read your wallet</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{errorMessage(wallet.error)}</p>
          <Button size="sm" variant="outline" onClick={() => wallet.refetch()} disabled={wallet.isFetching}>
            <RefreshCw className={cn('mr-2 h-4 w-4', wallet.isFetching && 'animate-spin')} /> Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const showProgress = flow.phase !== 'idle';

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">Wallet balance</dt>
          <dd className="text-lg font-semibold tabular-nums">{balance.toLocaleString()} t</dd>
        </div>
        <div className="rounded-lg border bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">Left to offset</dt>
          <dd className="text-lg font-semibold tabular-nums">{remaining.toLocaleString()} t</dd>
        </div>
      </dl>
      {address && (
        <p className="text-xs text-muted-foreground">
          From wallet <span className="font-mono">{shortHash(address, 8, 6)}</span>
          {wallet.data?.accountId && <> ({wallet.data.accountId})</>}
        </p>
      )}

      {balance === 0 && !showProgress ? (
        <div className="space-y-3 rounded-lg border border-dashed p-4 text-sm">
          <p className="text-muted-foreground">
            Your wallet holds no CO2e credits yet. Buy credits on the marketplace, then come back to retire them against this certificate. The
            offset advisor can suggest a basket.
          </p>
          <Button asChild size="sm">
            <Link href="/marketplace">
              <ShoppingCart className="mr-2 h-4 w-4" /> Go to marketplace
            </Link>
          </Button>
        </div>
      ) : flow.phase === 'done' && flow.retirement ? (
        <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4" />
            {flow.retirement.status === 'completed'
              ? `Retired ${Number(flow.retirement.amount).toLocaleString()} t CO2e`
              : `Retiring ${Number(flow.retirement.amount).toLocaleString()} t CO2e`}
          </p>
          {flow.retirement.status !== 'completed' && (
            <p className="text-emerald-800 dark:text-emerald-200">GreenTrace is finishing this retirement. The history below updates when it completes.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {flow.retirement.wipe_tx_id && <ExplorerLink kind="transaction" id={flow.retirement.wipe_tx_id} label="Burn transaction" />}
            <ConsensusProof sequence={flow.retirement.hcs_sequence} label="Retirement logged" />
          </div>
          {remaining > 0 && (
            <Button size="sm" variant="outline" onClick={flow.reset}>
              Retire more
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="retire-tonnes">Tonnes to retire</Label>
            <div className="flex gap-2">
              <Input
                id="retire-tonnes"
                type="number"
                inputMode="numeric"
                min={1}
                max={max}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={flow.busy || max === 0}
                className="min-w-0"
              />
              <Button type="button" variant="outline" onClick={() => setAmount(String(max))} disabled={flow.busy || max === 0}>
                Max
              </Button>
            </div>
            <p className={cn('text-xs', amount !== '' && !valid ? 'text-destructive' : 'text-muted-foreground')}>
              {max === 0 ? 'Nothing left to retire.' : `Whole tonnes from 1 to ${max.toLocaleString()}.`}
            </p>
          </div>
          {flow.phase === 'error' && (flow.failedAt === 'recording' || (flow.failedAt === 'network' && flow.txHash)) ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" className="flex-1" onClick={retry}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retry recording
              </Button>
              <Button type="button" variant="outline" onClick={flow.reset}>
                Start over
              </Button>
            </div>
          ) : (
            <Button type="submit" className="w-full" disabled={!valid || flow.busy || !address}>
              {flow.busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Flame className="mr-2 h-4 w-4" />}
              {flow.busy ? 'Retiring...' : valid ? `Retire ${tonnes.toLocaleString()} t` : 'Retire credits'}
            </Button>
          )}
        </form>
      )}

      {showProgress && <RetirementSteps phase={flow.phase} failedAt={flow.failedAt} txHash={flow.txHash} />}

      {flow.phase === 'error' && flow.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {flow.failedAt === 'recording'
              ? 'Retirement not recorded yet'
              : flow.failedAt === 'network'
                ? 'Could not confirm the request on chain'
                : 'Retirement request not sent'}
          </AlertTitle>
          <AlertDescription className="space-y-1">
            <p>{flow.error}</p>
            {flow.failedAt === 'recording' && (
              <p className="text-xs">Your request is on chain. Retrying records it without sending another transaction.</p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

const STEPS: { id: 'wallet' | 'network' | 'recording' | 'done'; label: string; detail: string }[] = [
  { id: 'wallet', label: 'Confirm in your wallet', detail: 'Approve the retirement request in your wallet.' },
  { id: 'network', label: 'Waiting for the network', detail: 'Hedera reaches consensus in a few seconds.' },
  { id: 'recording', label: 'Recording retirement', detail: 'GreenTrace checks the request on the mirror node, burns the credits and logs it to Hedera.' },
  { id: 'done', label: 'Done', detail: 'The certificate is updated.' },
];

function RetirementSteps({ phase, failedAt, txHash }: { phase: RetirementPhase; failedAt: 'wallet' | 'network' | 'recording' | null; txHash: string | null }) {
  const current = phase === 'error' ? failedAt : phase;
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <ol className="space-y-3" aria-label="Retirement progress">
      {STEPS.map((step, index) => {
        const state =
          phase === 'done' || index < currentIndex ? 'complete' : index === currentIndex ? (phase === 'error' ? 'failed' : 'active') : 'upcoming';
        return (
          <li key={step.id} className="flex gap-3">
            {state === 'complete' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : state === 'active' ? (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
            ) : state === 'failed' ? (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
            )}
            <div className="min-w-0">
              <p className={cn('text-sm', state === 'upcoming' ? 'text-muted-foreground' : 'font-medium')}>{step.label}</p>
              {state === 'active' && <p className="text-xs text-muted-foreground">{step.detail}</p>}
              {step.id === 'network' && state !== 'upcoming' && txHash && (
                <ExplorerLink kind="transaction" id={txHash} label={`Request ${shortHash(txHash, 8, 6)}`} />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
