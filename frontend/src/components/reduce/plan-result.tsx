'use client';

import { format } from 'date-fns';
import { AlertTriangle, Calculator, Calendar, Clock, Coins, Gauge, Hash, Target, TrendingDown } from 'lucide-react';
import { AiLabel } from '@/components/ai/ai-label';
import { ConsensusProof } from '@/components/chain/consensus-proof';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { shortHash } from '@/lib/format';
import type { ReductionMeasure, ReductionPlan } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatT } from './format';
import { TrajectoryChart } from './trajectory-chart';

const CAPEX_STYLE: Record<ReductionMeasure['capex'], string> = {
  low: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  medium: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  high: 'border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};

const DIFFICULTY_STYLE: Record<ReductionMeasure['difficulty'], string> = {
  easy: 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300',
  moderate: 'border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300',
  hard: 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-300',
};

function Kpi({ label, value, unit, icon: Icon }: { label: string; value: string; unit?: string; icon: typeof Target }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

function MeasureCard({ measure, rank, maxTonnes }: { measure: ReductionMeasure; rank: number; maxTonnes: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h4 className="font-semibold leading-snug">{measure.title}</h4>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="max-w-full truncate font-normal" title={measure.targetCategory}>
                  {measure.targetCategory}
                </Badge>
                <Badge variant="outline" className={cn('font-normal', measure.scope === 'Scope 2' ? 'text-sky-700 dark:text-sky-300' : 'text-emerald-700 dark:text-emerald-300')}>
                  {measure.scope}
                </Badge>
              </div>
            </div>
            <div className="shrink-0 sm:text-right">
              <p className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                -{formatT(measure.annualReductionTonnes)} <span className="text-sm font-medium">t/yr</span>
              </p>
              <p className="text-xs text-muted-foreground">{Math.round(measure.reductionShare * 100)}% of this category</p>
            </div>
          </div>

          <div className="mt-3 h-1.5 rounded-full bg-muted" aria-hidden>
            <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${maxTonnes > 0 ? Math.max(2, (measure.annualReductionTonnes / maxTonnes) * 100) : 0}%` }} />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            <Badge variant="outline" className={cn('gap-1 font-medium capitalize', CAPEX_STYLE[measure.capex])}>
              <Coins className="h-3 w-3" /> {measure.capex} capex
            </Badge>
            <Badge variant="outline" className={cn('gap-1 font-medium capitalize', DIFFICULTY_STYLE[measure.difficulty])}>
              <Gauge className="h-3 w-3" /> {measure.difficulty}
            </Badge>
            <Badge variant="outline" className="gap-1 font-normal">
              <Clock className="h-3 w-3" />
              {measure.paybackYears === null ? 'No payback estimate' : `${measure.paybackYears} yr payback`}
            </Badge>
            <Badge variant="outline" className="gap-1 font-normal">
              <Calendar className="h-3 w-3" /> Starts {measure.startYear}
            </Badge>
          </div>

          <p className="mt-3 text-sm leading-relaxed">{measure.description}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/80">Why this share: </span>
            {measure.rationale}
          </p>
        </div>
      </div>
    </div>
  );
}

function inputText(inputs: Record<string, unknown>): string {
  const parts = [inputs.industry, inputs.region, inputs.budget ? `${String(inputs.budget)} budget` : null].filter(Boolean);
  return parts.map(String).join(' / ');
}

export function PlanResult({ plan }: { plan: ReductionPlan }) {
  const content = plan.plan;
  const measures = [...content.measures].sort((a, b) => b.annualReductionTonnes - a.annualReductionTonnes);
  const maxTonnes = measures[0]?.annualReductionTonnes ?? 0;
  const remaining = Math.max(0, content.baselineTonnes - content.totalAnnualReductionTonnes);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2">
              Reduction plan to {content.targetYear}
              <AiLabel model={plan.model} />
            </CardTitle>
            <CardDescription className="mt-1">
              {inputText(plan.inputs)}
              {inputText(plan.inputs) ? ' - ' : ''}
              {format(new Date(plan.created_at), 'PPP p')}
            </CardDescription>
          </div>
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <ConsensusProof sequence={plan.hcs_sequence} label="Plan hash anchored on Hedera" />
            <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground" title={plan.plan_hash}>
              <Hash className="h-3 w-3" />
              {shortHash(plan.plan_hash, 10, 6)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="leading-relaxed">{content.summary}</p>

        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Baseline" value={formatT(content.baselineTonnes)} unit="t CO2e/yr" icon={Target} />
          <Kpi label="Annual reduction" value={formatT(content.totalAnnualReductionTonnes)} unit="t/yr" icon={TrendingDown} />
          <Kpi label="Versus baseline" value={`-${content.reductionPercent}%`} icon={Gauge} />
          <Kpi label={`Remaining in ${content.targetYear}`} value={formatT(remaining)} unit="t/yr" icon={Calendar} />
        </div>

        <p className="flex items-start gap-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
          <Calculator className="mt-0.5 h-4 w-4 shrink-0" />
          Tonnes are computed by GreenTrace from your inventory: the AI proposes measures and the share of a category each removes, and the server
          turns that into tonnes using your measured emissions, capping overlapping measures at 95% of a category.
        </p>

        {content.trajectory.length > 1 && (
          <section>
            <h3 className="mb-3 font-semibold">Trajectory</h3>
            <TrajectoryChart trajectory={content.trajectory} />
          </section>
        )}

        <section>
          <h3 className="mb-3 font-semibold">
            Measures <span className="font-normal text-muted-foreground">by impact</span>
          </h3>
          {measures.length === 0 ? (
            <p className="text-sm text-muted-foreground">No measures could be matched to this inventory&apos;s categories.</p>
          ) : (
            <div className="space-y-3">
              {measures.map((m, i) => (
                <MeasureCard key={m.id} measure={m} rank={i + 1} maxTonnes={maxTonnes} />
              ))}
            </div>
          )}
        </section>

        {content.caveats.length > 0 && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4" /> Caveats
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-200">
              {content.caveats.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
