'use client';

import { AlertCircle, CheckCircle2, Clock, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AiLabel } from '@/components/ai/ai-label';
import { ConsensusProof } from '@/components/chain/consensus-proof';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRunAudit } from '@/hooks/use-api';
import { toast } from '@/hooks/use-toast';
import { errorMessage, shortHash } from '@/lib/format';
import type { AiAudit, AuditFinding, EmissionData, FindingSeverity, InventoryLine } from '@/lib/types';
import { cn } from '@/lib/utils';
import { RiskBadge, SeverityBadge } from './badges';
import { formatDate, formatQuantity, isAuditCurrent } from './inventory-utils';
import { RISK_TONES, SEVERITY_TONES } from './tones';

const SEVERITY_ORDER: FindingSeverity[] = ['high', 'medium', 'low', 'info'];

interface AuditPanelProps {
  inventory: EmissionData;
  lines: InventoryLine[];
  audits: AiAudit[] | undefined;
  loading: boolean;
  loadError: unknown;
  certified: boolean;
}

export function AuditPanel({ inventory, lines, audits, loading, loadError, certified }: AuditPanelProps) {
  const run = useRunAudit();
  const latest = audits?.[0];
  const current = latest ? isAuditCurrent(latest, inventory) : false;
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!run.isPending) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [run.isPending]);

  const start = () => {
    setStartedAt(Date.now());
    setNow(Date.now());
    run.mutate(inventory.id, {
      onSuccess: (audit) =>
        toast({ title: 'Audit complete', description: `${RISK_TONES[audit.risk_level].label}, score ${audit.risk_score}/100.` }),
      onError: (error) => toast({ variant: 'destructive', title: 'Audit failed', description: errorMessage(error) }),
    });
  };

  const elapsed = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
  const lineLabel = (id: string) => {
    const index = lines.findIndex((l) => l.id === id);
    if (index === -1) return id;
    const line = lines[index];
    return `${line.fuelType}, ${formatQuantity(line.quantity)} ${line.unit}`;
  };

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            AI audit
            {latest && (latest.model ? <AiLabel model={latest.model} text="AI reviewed" /> : <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Rule checks only</span>)}
          </CardTitle>
          <CardDescription>
            Automated checks for double counting, overlaps, outliers and missing evidence, plus an AI review for unit slips and misclassification.
          </CardDescription>
        </div>
        {!certified && (
          <Button onClick={start} disabled={run.isPending || lines.length === 0} className="w-full shrink-0 sm:w-auto">
            {run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            {run.isPending ? 'Auditing...' : latest ? 'Re-run audit' : 'Run audit'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {run.isPending && (
          <div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
            <div>
              <p className="font-medium">Auditing... {elapsed}s</p>
              <p className="text-violet-800/80 dark:text-violet-200/80">This usually takes 30 to 90 seconds. You can keep reviewing the lines meanwhile.</p>
            </div>
          </div>
        )}
        {run.isError && !run.isPending && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>The audit did not complete</AlertTitle>
            <AlertDescription>{errorMessage(run.error)}</AlertDescription>
          </Alert>
        )}
        {loadError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Could not load audits: {errorMessage(loadError)}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            <div className="h-6 w-40 animate-pulse rounded bg-muted" />
            <div className="h-16 animate-pulse rounded bg-muted" />
          </div>
        ) : !latest ? (
          !run.isPending && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {certified ? 'No audit is recorded for this inventory.' : 'No audit yet. Run one to check the inventory before issuing a certificate.'}
            </div>
          )
        ) : (
          <LatestAudit audit={latest} current={current} lineLabel={lineLabel} earlier={(audits?.length ?? 1) - 1} />
        )}
      </CardContent>
    </Card>
  );
}

function LatestAudit({ audit, current, lineLabel, earlier }: { audit: AiAudit; current: boolean; lineLabel: (id: string) => string; earlier: number }) {
  const grouped = SEVERITY_ORDER.map((severity) => ({ severity, findings: audit.findings.filter((f) => f.severity === severity) })).filter(
    (g) => g.findings.length > 0,
  );
  const tone = RISK_TONES[audit.risk_level];
  const passed = audit.checks.filter((c) => c.passed).length;

  return (
    <div className="space-y-5">
      {!current && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 [&>svg]:text-amber-600">
          <Clock className="h-4 w-4" />
          <AlertTitle>Out of date</AlertTitle>
          <AlertDescription>The inventory changed after this audit. Run it again before issuing a certificate.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Risk score</p>
            <p className="text-3xl font-bold tabular-nums">
              {audit.risk_score}
              <span className="text-base font-medium text-muted-foreground">/100</span>
            </p>
          </div>
          <RiskBadge level={audit.risk_level} />
        </div>
        <div className="space-y-1.5">
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={audit.risk_score}>
            <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${Math.min(100, Math.max(0, audit.risk_score))}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            Audited {formatDate(audit.created_at, 'd MMM yyyy, HH:mm')}
            {earlier > 0 && ` · ${earlier} earlier ${earlier === 1 ? 'audit' : 'audits'}`}
          </p>
        </div>
      </div>

      {audit.summary && <p className="text-sm leading-relaxed">{audit.summary}</p>}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">
          Findings <span className="font-normal text-muted-foreground">({audit.findings.length})</span>
        </h3>
        {grouped.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            No issues found.
          </p>
        ) : (
          grouped.map(({ severity, findings }) => (
            <div key={severity} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {SEVERITY_TONES[severity].label} ({findings.length})
              </p>
              <ul className="space-y-2">
                {findings.map((finding) => (
                  <FindingCard key={finding.id} finding={finding} lineLabel={lineLabel} />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {audit.checks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">
            Checks <span className="font-normal text-muted-foreground">({passed} of {audit.checks.length} passed)</span>
          </h3>
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {audit.checks.map((check) => (
              <li key={check.check} className="flex items-start gap-2 text-sm">
                {check.passed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                )}
                <span className={cn(!check.passed && 'font-medium')}>{check.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t pt-4 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <ConsensusProof sequence={audit.hcs_sequence} label="Audit anchored on Hedera" />
        <span className="font-mono" title={audit.audit_hash}>
          Ruleset {audit.ruleset_version} · hash {shortHash(audit.audit_hash, 8, 6)}
        </span>
      </div>
    </div>
  );
}

function FindingCard({ finding, lineLabel }: { finding: AuditFinding; lineLabel: (id: string) => string }) {
  return (
    <li className={cn('space-y-2 rounded-md border border-l-4 bg-background p-3', SEVERITY_TONES[finding.severity].border)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 font-medium">{finding.title}</p>
        <SeverityBadge severity={finding.severity} />
      </div>
      <p className="text-sm text-muted-foreground">{finding.detail}</p>
      {finding.lineIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Lines:</span>
          {finding.lineIds.map((id) => (
            <a
              key={id}
              href={`#line-${id}`}
              className="max-w-full truncate rounded bg-muted px-1.5 py-0.5 hover:bg-accent hover:underline"
              title={id}
            >
              {lineLabel(id)}
            </a>
          ))}
        </div>
      )}
      {finding.recommendation && (
        <p className="text-sm">
          <span className="font-medium">Recommendation: </span>
          {finding.recommendation}
        </p>
      )}
    </li>
  );
}
