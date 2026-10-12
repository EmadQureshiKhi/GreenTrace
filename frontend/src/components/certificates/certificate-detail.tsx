'use client';

import { AlertCircle, ArrowLeft, Award, CheckCircle2, Home, Leaf, Loader2, RefreshCw, SearchX, ShieldAlert, ShieldCheck, ShieldEllipsis } from 'lucide-react';
import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useCertificateVerification, type VerificationResult } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api';
import { errorMessage, formatKg, formatTonnes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AuditSummary } from './audit-summary';
import { CertificateStatusBadge } from './certificate-badges';
import { certifiedTonnes, formatDate, formatPeriod, inventoryLines, offsetPercent, remainingTonnes, verificationPath } from './certificate-utils';
import { CopyButton } from './copy-button';
import { ActivityLines, EmissionsBreakdown } from './emissions-breakdown';
import { OffsetAdvisorCard } from './offset-advisor-card';
import { OnchainProofs } from './onchain-proofs';
import { RetireCreditsCard } from './retire-credits-card';
import { RetirementHistory } from './retirement-history';
import { VerificationPanel } from './verification-panel';

/** Retirements still in flight after this long are treated as stuck and no longer polled for. */
const RECENT_RETIREMENT_MS = 10 * 60 * 1000;

type SealState = 'verifying' | 'verified' | 'failed' | 'pending';

function sealState(result: VerificationResult): SealState {
  if (result.checks.some((c) => c.status === 'fail')) return 'failed';
  if (result.verified) return 'verified';
  return 'pending';
}

export function CertificateDetail({ certificateId }: { certificateId: string }) {
  const { user, isAuthenticated } = useAuth();
  const query = useCertificateVerification(certificateId);
  const { refetch } = query;
  const inFlight = Boolean(
    query.data?.retirements.some(
      (r) => (r.status === 'pending' || r.status === 'processing') && Date.now() - Date.parse(r.created_at) < RECENT_RETIREMENT_MS,
    ),
  );

  // A retirement finishing in the background changes the offset; poll while a recent one is in flight.
  useEffect(() => {
    if (!inFlight) return;
    const timer = setInterval(() => refetch(), 10_000);
    return () => clearInterval(timer);
  }, [inFlight, refetch]);

  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotFound certificateId={certificateId} signedIn={isAuthenticated} />;
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <BackLink signedIn={isAuthenticated} />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not verify {certificateId}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{errorMessage(query.error)}</p>
            <Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
              <RefreshCw className={cn('mr-2 h-4 w-4', query.isFetching && 'animate-spin')} /> Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!query.data) return <LoadingState certificateId={certificateId} signedIn={isAuthenticated} />;

  const result = query.data;
  const { certificate } = result;
  const isOwner = Boolean(user && user.id === certificate.user_id);
  const remaining = remainingTonnes(certificate);
  const lines = inventoryLines(result.inventory?.processed_data);

  return (
    <div className="space-y-6">
      <BackLink signedIn={isAuthenticated} />

      <Hero
        result={result}
        isOwner={isOwner}
        remaining={remaining}
        refreshing={query.isFetching}
        onReverify={() => query.refetch()}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <VerificationPanel checks={result.checks} />
          <EmissionsBreakdown breakdown={certificate.breakdown} totalKg={Number(certificate.total_emissions)} />
        </div>
        <div className="min-w-0 space-y-6">
          <OnchainProofs certificate={certificate} />
          {result.audit && <AuditSummary audit={result.audit} />}
        </div>
      </div>

      <ActivityLines lines={lines} available={Boolean(result.inventory)} />
      <RetirementHistory retirements={result.retirements} />

      {isOwner && (
        <section id="offset" className="scroll-mt-24 space-y-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Offset this certificate</h2>
            <p className="text-sm text-muted-foreground">Only you see this section, because you own this certificate.</p>
          </div>
          {remaining === 0 ? (
            <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
              <CardContent className="flex items-start gap-3 p-6">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                <div className="space-y-1">
                  <p className="font-medium text-emerald-900 dark:text-emerald-100">Fully offset</p>
                  <p className="text-sm text-emerald-800 dark:text-emerald-200">
                    {Number(certificate.offset_tonnes).toLocaleString()} t of credits have been retired against this certificate, covering all of its
                    certified emissions.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-5">
              <div className="min-w-0 lg:col-span-2">
                <RetireCreditsCard certificate={certificate} remaining={remaining} />
              </div>
              <div className="min-w-0 lg:col-span-3">
                <OffsetAdvisorCard certificate={certificate} remaining={remaining} />
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Hero({
  result,
  isOwner,
  remaining,
  refreshing,
  onReverify,
}: {
  result: VerificationResult;
  isOwner: boolean;
  remaining: number;
  refreshing: boolean;
  onReverify: () => void;
}) {
  const { certificate, inventory } = result;
  const kg = Number(certificate.total_emissions);
  const needed = certifiedTonnes(certificate);
  const expired = Date.parse(certificate.valid_until) < Date.now();
  const shareUrl = typeof window === 'undefined' ? verificationPath(certificate.certificate_id) : `${window.location.origin}${verificationPath(certificate.certificate_id)}`;

  return (
    <Card className="overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <CertificateStatusBadge status={certificate.status} />
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Award className="h-3.5 w-3.5" /> Scope 1 and 2 GHG emissions certificate
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{certificate.title}</h1>
            {certificate.organization && <p className="text-muted-foreground">{certificate.organization}</p>}
            <div className="flex items-center gap-1">
              <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm">{certificate.certificate_id}</code>
              <CopyButton value={certificate.certificate_id} label="Copy certificate id" successMessage="Certificate id copied" />
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <HeroFact label="Total emissions">
              <span className="text-2xl font-bold tabular-nums">{formatTonnes(kg)}</span>
              <span className="text-sm font-normal text-muted-foreground"> CO2e</span>
              <span className="block text-xs font-normal text-muted-foreground">{formatKg(kg)}</span>
            </HeroFact>
            <HeroFact label="Reporting period">
              {formatPeriod(inventory?.reporting_period_start, inventory?.reporting_period_end)}
            </HeroFact>
            <HeroFact label="Issued">{formatDate(certificate.issue_date)}</HeroFact>
            <HeroFact label="Valid until">
              <span className={cn(expired && 'text-red-600 dark:text-red-400')}>{formatDate(certificate.valid_until)}</span>
              {expired && <span className="block text-xs font-normal text-red-600 dark:text-red-400">Expired</span>}
            </HeroFact>
          </dl>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Offset with retired credits</span>
              <span className="font-medium tabular-nums">
                {Number(certificate.offset_tonnes).toLocaleString()} of {needed.toLocaleString()} t
              </span>
            </div>
            <Progress value={offsetPercent(certificate)} className="h-2" aria-label="Offset progress" />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <CopyButton
              value={shareUrl}
              text="Copy verification link"
              label="Copy verification link"
              successMessage="Verification link copied"
              variant="outline"
            />
            {isOwner && remaining > 0 && (
              <Button asChild>
                <a href="#offset">
                  <Leaf className="mr-2 h-4 w-4" /> Offset this certificate
                </a>
              </Button>
            )}
          </div>
        </div>

        <VerificationSeal state={sealState(result)} result={result} refreshing={refreshing} onReverify={onReverify} />
      </div>
    </Card>
  );
}

function HeroFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  );
}

const SEAL: Record<SealState, { icon: typeof ShieldCheck; title: string; body: string; panel: string; iconClass: string }> = {
  verifying: {
    icon: ShieldEllipsis,
    title: 'Verifying',
    body: 'Recomputing the inventory hash and reading the records on Hedera.',
    panel: 'bg-muted/50',
    iconClass: 'text-muted-foreground',
  },
  verified: {
    icon: ShieldCheck,
    title: 'Verified',
    body: 'The data matches every record on Hedera and the certificate metadata.',
    panel: 'bg-emerald-50 dark:bg-emerald-950/40',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
  },
  failed: {
    icon: ShieldAlert,
    title: 'Verification failed',
    body: 'At least one check does not match. See the details below.',
    panel: 'bg-red-50 dark:bg-red-950/40',
    iconClass: 'text-red-600 dark:text-red-400',
  },
  pending: {
    icon: ShieldEllipsis,
    title: 'Verifying',
    body: 'Some records are not indexed by the Hedera mirror node yet. Check again in a minute.',
    panel: 'bg-amber-50 dark:bg-amber-950/40',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
};

function VerificationSeal({
  state,
  result,
  refreshing,
  onReverify,
}: {
  state: SealState;
  result?: VerificationResult;
  refreshing?: boolean;
  onReverify?: () => void;
}) {
  const meta = SEAL[state];
  const Icon = meta.icon;
  const passed = result?.checks.filter((c) => c.status === 'pass').length ?? 0;

  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 border-t p-6 text-center lg:border-l lg:border-t-0', meta.panel)}
      role="status"
      aria-live="polite"
    >
      <div className="relative">
        <Icon className={cn('h-16 w-16', meta.iconClass, state === 'verifying' && 'animate-pulse')} strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <p className="text-xl font-semibold">{meta.title}</p>
        <p className="text-sm text-muted-foreground">{meta.body}</p>
      </div>
      {result && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {passed} of {result.checks.length} checks passed
        </p>
      )}
      {onReverify && (
        <Button size="sm" variant="ghost" onClick={onReverify} disabled={refreshing}>
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {refreshing ? 'Checking...' : 'Check again'}
        </Button>
      )}
    </div>
  );
}

function BackLink({ signedIn }: { signedIn: boolean }) {
  if (!signedIn) return null;
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
      <Link href="/certificates">
        <ArrowLeft className="mr-2 h-4 w-4" /> My certificates
      </Link>
    </Button>
  );
}

function LoadingState({ certificateId, signedIn }: { certificateId: string; signedIn: boolean }) {
  return (
    <div className="space-y-6" aria-busy="true">
      <BackLink signedIn={signedIn} />
      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-6 p-5 sm:p-6">
            <div className="h-5 w-48 animate-pulse rounded-full bg-muted" />
            <div className="space-y-3">
              <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
              <code className="inline-block rounded bg-muted px-2 py-0.5 font-mono text-sm">{certificateId}</code>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
            <div className="h-2 animate-pulse rounded-full bg-muted" />
          </div>
          <VerificationSeal state="verifying" />
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-lg border bg-muted/40 lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-lg border bg-muted/40" />
      </div>
    </div>
  );
}

function NotFound({ certificateId, signedIn }: { certificateId: string; signedIn: boolean }) {
  return (
    <div className="flex justify-center py-8">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <SearchX className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Certificate not found</h1>
            <p className="text-sm text-muted-foreground">
              No GreenTrace certificate has the id <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{certificateId}</code>.
              Check the link, or ask the issuer for the correct certificate id.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {signedIn && (
              <Button asChild>
                <Link href="/certificates">
                  <Award className="mr-2 h-4 w-4" /> My certificates
                </Link>
              </Button>
            )}
            <Button asChild variant={signedIn ? 'outline' : 'default'}>
              <Link href="/">
                <Home className="mr-2 h-4 w-4" /> Home
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
