'use client';

import { AlertCircle, ArrowUpRight, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AiLabel } from '@/components/ai/ai-label';
import { AiUnavailable } from '@/components/ai/ai-unavailable';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useAiStatus, useOffsetAdvisor, type OffsetAdvice } from '@/hooks/use-api';
import { errorMessage, formatHbar } from '@/lib/format';
import type { Certificate } from '@/lib/types';
import { GradeBadge } from './certificate-badges';
import { formatNumber } from './certificate-utils';

const MAX_BUDGET = 1_000_000;
const MAX_PREFERENCES = 500;

export function OffsetAdvisorCard({ certificate, remaining }: { certificate: Certificate; remaining: number }) {
  const ai = useAiStatus();
  const advisor = useOffsetAdvisor();
  const [budget, setBudget] = useState('');
  const [preferences, setPreferences] = useState('');

  const budgetValue = budget.trim() === '' ? null : Number(budget);
  const budgetValid = budgetValue === null || (Number.isFinite(budgetValue) && budgetValue > 0 && budgetValue <= MAX_BUDGET);
  const unavailable = ai.data?.configured === false;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!budgetValid || advisor.isPending) return;
    advisor.mutate({ certificateId: certificate.id, budgetHbar: budgetValue, preferences: preferences.trim() || undefined });
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" /> Offset advisor
          </CardTitle>
          {!unavailable && <AiLabel model={advisor.data?.model ?? ai.data?.model} />}
        </div>
        <CardDescription>
          Get a diversified basket of rated credits that covers the remaining {remaining.toLocaleString()} t, within your budget.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <AiUnavailable feature="The offset advisor" />

        {!unavailable && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
              <div className="space-y-1.5">
                <Label htmlFor="advisor-budget">Budget (HBAR)</Label>
                <Input
                  id="advisor-budget"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={MAX_BUDGET}
                  step="any"
                  placeholder="No limit"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  disabled={advisor.isPending}
                  aria-invalid={!budgetValid}
                />
                {!budgetValid && <p className="text-xs text-destructive">Enter an amount above 0 and up to {MAX_BUDGET.toLocaleString()}.</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="advisor-preferences">Preferences (optional)</Label>
                <textarea
                  id="advisor-preferences"
                  rows={2}
                  maxLength={MAX_PREFERENCES}
                  placeholder="For example: prefer removals, projects in Africa, recent vintages"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  disabled={advisor.isPending}
                  className="flex min-h-[2.5rem] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
            <Button type="submit" disabled={!budgetValid || advisor.isPending} className="w-full sm:w-auto">
              {advisor.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {advisor.isPending ? 'Building your basket...' : advisor.data ? 'Suggest again' : 'Suggest a basket'}
            </Button>
          </form>
        )}

        {advisor.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>The advisor could not build a basket</AlertTitle>
            <AlertDescription>{errorMessage(advisor.error)}</AlertDescription>
          </Alert>
        )}

        {advisor.data && !advisor.isPending && <AdviceResult advice={advisor.data} />}
      </CardContent>
    </Card>
  );
}

function AdviceResult({ advice }: { advice: OffsetAdvice }) {
  const coverage = Math.round(advice.coverage * 100);

  return (
    <div className="space-y-5 border-t pt-5">
      <p className="text-sm leading-relaxed">{advice.summary}</p>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Needed" value={`${advice.tonnesNeeded.toLocaleString()} t`} />
        <Stat label="In basket" value={`${advice.totalTonnes.toLocaleString()} t`} />
        <Stat label="Total cost" value={formatHbar(advice.totalCostHbar)} />
        <Stat label="Coverage" value={`${coverage}%`} />
      </dl>
      <Progress value={coverage} className="h-2" aria-label="Coverage of remaining emissions" />

      {advice.basket.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No credits fit these constraints. Try a larger budget or fewer preferences.
        </p>
      ) : (
        <div className="-mx-6 overflow-x-auto px-6">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Project</th>
                <th className="pb-2 pr-4 font-medium">Grade</th>
                <th className="pb-2 pr-4 text-right font-medium">Tonnes</th>
                <th className="pb-2 pr-4 text-right font-medium">Price / t</th>
                <th className="pb-2 pr-4 text-right font-medium">Cost</th>
                <th className="pb-2 pr-4 font-medium">Why</th>
                <th className="pb-2 font-medium">
                  <span className="sr-only">Buy</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {advice.basket.map((item) => (
                <tr key={item.creditId} className="align-top">
                  <td className="py-2.5 pr-4 font-medium">{item.title}</td>
                  <td className="py-2.5 pr-4">
                    <GradeBadge grade={item.grade} />
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-right tabular-nums">{item.quantity.toLocaleString()}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-right tabular-nums">{formatNumber(item.priceHbar, 4)}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-right font-medium tabular-nums">{formatHbar(item.costHbar)}</td>
                  <td className="max-w-[18rem] py-2.5 pr-4 text-xs text-muted-foreground">{item.reason}</td>
                  <td className="py-2.5">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/marketplace?credit=${encodeURIComponent(item.creditId)}&qty=${item.quantity}`}>
                        Buy <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {advice.considerations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Considerations</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {advice.considerations.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Suggested by AI from current listings and their ratings. Quantities and costs are computed by GreenTrace, not the model.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/40 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-semibold tabular-nums" title={value}>
        {value}
      </dd>
    </div>
  );
}
