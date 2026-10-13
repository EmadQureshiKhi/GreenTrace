'use client';

import { type FormEvent } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { BUDGETS, type Budget } from './format';

export interface PlanFormValues {
  industry: string;
  region: string;
  budget: Budget;
  targetYear: number;
  notes: string;
}

const INDUSTRIES = [
  'Manufacturing',
  'Retail',
  'Logistics and transport',
  'Food and beverage',
  'Hospitality',
  'Healthcare',
  'Education',
  'Office and professional services',
  'Technology and data centers',
  'Construction',
  'Agriculture',
  'Real estate',
];

const NOTES_MAX = 1000;

export function defaultTargetYear(): number {
  return Math.max(2030, new Date().getFullYear() + 1);
}

export function PlanForm({
  values,
  onChange,
  onSubmit,
  isPending,
  disabledReason,
}: {
  values: PlanFormValues;
  onChange: (values: PlanFormValues) => void;
  onSubmit: () => void;
  isPending: boolean;
  disabledReason: string | null;
}) {
  const firstYear = new Date().getFullYear() + 1;
  const years = Array.from({ length: 2050 - firstYear + 1 }, (_, i) => firstYear + i);
  const set = <K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) => onChange({ ...values, [key]: value });
  const valid = values.industry.trim().length >= 2 && values.region.trim().length >= 2 && values.notes.length <= NOTES_MAX;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (valid && !disabledReason) onSubmit();
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Plan settings</CardTitle>
        <CardDescription>Context the AI uses to choose realistic measures</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="plan-industry">Industry</Label>
            <Input
              id="plan-industry"
              list="plan-industry-options"
              value={values.industry}
              onChange={(e) => set('industry', e.target.value)}
              placeholder="e.g. Manufacturing"
              maxLength={100}
              required
            />
            <datalist id="plan-industry-options">
              {INDUSTRIES.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-region">Region or country</Label>
            <Input
              id="plan-region"
              value={values.region}
              onChange={(e) => set('region', e.target.value)}
              placeholder="e.g. Germany"
              maxLength={100}
              required
            />
            <p className="text-xs text-muted-foreground">Grid mix, policy and incentives differ by location.</p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium leading-none">Budget</legend>
            <div role="radiogroup" aria-label="Budget" className="grid gap-2">
              {BUDGETS.map((b) => {
                const selected = values.budget === b.value;
                return (
                  <button
                    key={b.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => set('budget', b.value)}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40' : 'hover:bg-muted/60',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                        selected ? 'border-emerald-600' : 'border-muted-foreground/50',
                      )}
                    >
                      {selected && <span className="h-2 w-2 rounded-full bg-emerald-600" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{b.label}</span>
                      <span className="block text-xs text-muted-foreground">{b.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="plan-year">Target year</Label>
            <Select value={String(values.targetYear)} onValueChange={(v) => set('targetYear', Number(v))}>
              <SelectTrigger id="plan-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="plan-notes">Notes (optional)</Label>
              <span className={cn('text-xs tabular-nums', values.notes.length > NOTES_MAX ? 'text-destructive' : 'text-muted-foreground')}>
                {values.notes.length}/{NOTES_MAX}
              </span>
            </div>
            <textarea
              id="plan-notes"
              value={values.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              placeholder="Constraints or context, e.g. leased building, fleet replaced in 2028"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <Button type="submit" className="w-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={!valid || isPending || Boolean(disabledReason)}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {isPending ? 'Generating plan...' : 'Generate reduction plan'}
          </Button>
          {disabledReason && <p className="text-center text-xs text-muted-foreground">{disabledReason}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
