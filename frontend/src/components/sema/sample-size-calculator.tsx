'use client';

import { useState } from 'react';
import { BarChart3, Calculator, Loader2, Save, TrendingUp, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HcsTransactionDisplay } from '@/components/ui/hcs-transaction-display';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSema } from './sema-context';
import { EmptyState, ModuleSkeleton } from './sema-shared';
import { runWithToast } from './sema-utils';
import { adjustedSampleSize, baseSampleSize, zScore, type SampleParametersInput, type SemaSampleParameters } from './sema-types';

function OptionGroup({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (value: number) => void;
  help: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = Math.abs(value - option.value) < 1e-9;
          return (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                'min-w-[3.5rem] rounded-md border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );
}

function toInput(saved: SemaSampleParameters | null): SampleParametersInput {
  return {
    confidence_level: saved?.confidence_level ?? 0.95,
    margin_error: saved?.margin_error ?? 0.05,
    population_proportion: saved?.population_proportion ?? 0.5,
  };
}

function CalculatorBody({ saved }: { saved: SemaSampleParameters | null }) {
  const { isDemo, stakeholders, latestSampleParamsHcsTx, updateSampleParameters, setActiveSemaModule } = useSema();
  const [parameters, setParameters] = useState<SampleParametersInput>(() => toInput(saved));
  const [isSaving, setIsSaving] = useState(false);

  const base = baseSampleSize(parameters);
  const z = zScore(parameters.confidence_level);
  const savedInput = toInput(saved);
  const isDirty =
    !saved ||
    savedInput.confidence_level !== parameters.confidence_level ||
    savedInput.margin_error !== parameters.margin_error ||
    savedInput.population_proportion !== parameters.population_proportion;

  const rows = stakeholders.map((s) => {
    const { size, formula } = adjustedSampleSize(base, s.population_size);
    return { stakeholder: s, size, formula, rate: s.population_size > 0 ? (size / s.population_size) * 100 : null };
  });
  const totalSample = rows.reduce((sum, r) => sum + r.size, 0);
  const unknownPopulation = stakeholders.some((s) => s.population_size === 0);
  const totalPopulation = stakeholders.reduce((sum, s) => sum + s.population_size, 0);

  const handleSave = async () => {
    setIsSaving(true);
    await runWithToast(() => updateSampleParameters(parameters), { title: 'Sample parameters saved', description: `Base sample size ${base}` });
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-sky-600" />
              Parameters
            </CardTitle>
            <CardDescription>Survey precision for the stakeholder questionnaire</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <OptionGroup
              label="Confidence level"
              value={parameters.confidence_level}
              options={[
                { value: 0.9, label: '90%' },
                { value: 0.95, label: '95%' },
                { value: 0.99, label: '99%' },
              ]}
              onChange={(v) => setParameters((p) => ({ ...p, confidence_level: v }))}
              help="How sure you want to be that the result reflects the whole group."
            />
            <OptionGroup
              label="Margin of error"
              value={parameters.margin_error}
              options={[
                { value: 0.01, label: '1%' },
                { value: 0.03, label: '3%' },
                { value: 0.05, label: '5%' },
                { value: 0.1, label: '10%' },
              ]}
              onChange={(v) => setParameters((p) => ({ ...p, margin_error: v }))}
              help="How far the survey result may be from the true value."
            />
            <OptionGroup
              label="Expected proportion"
              value={parameters.population_proportion}
              options={[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => ({ value: v, label: v.toFixed(1) }))}
              onChange={(v) => setParameters((p) => ({ ...p, population_proportion: v }))}
              help="Use 0.5 when unsure; it gives the most conservative sample size."
            />
            {isDemo ? (
              <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                The demo organization is read-only. Try different values here; they are not saved.
              </p>
            ) : (
              <Button onClick={handleSave} disabled={isSaving || !isDirty} className="w-full">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isDirty ? 'Save parameters' : 'Saved'}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 dark:border-green-900 dark:from-green-950/60 dark:to-emerald-950/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
              <TrendingUp className="h-5 w-5" />
              Base sample size
            </CardTitle>
            <CardDescription className="text-green-800 dark:text-green-300">
              Large or unknown populations{isDirty && saved ? ', unsaved values' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-6xl font-bold tabular-nums text-green-700 dark:text-green-300">{base}</div>
              <p className="mt-1 text-sm font-medium text-green-800 dark:text-green-300">respondents per stakeholder group</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-background p-4 text-center">
                <div className="text-2xl font-bold tabular-nums">{z}</div>
                <p className="text-sm text-muted-foreground">Z-score</p>
                <p className="text-xs text-green-700 dark:text-green-400">{Math.round(parameters.confidence_level * 100)}% confidence</p>
              </div>
              <div className="rounded-lg bg-background p-4 text-center">
                <div className="text-2xl font-bold tabular-nums">{Math.round(parameters.margin_error * 100)}%</div>
                <p className="text-sm text-muted-foreground">Margin of error</p>
                <p className="text-xs text-green-700 dark:text-green-400">+/- {Math.round(parameters.margin_error * 100)} points</p>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/50">
              <h4 className="mb-1 font-medium text-amber-900 dark:text-amber-100">Formula</h4>
              <code className="text-sm text-amber-800 dark:text-amber-200">n = (Z² × p × (1 - p)) / E²</code>
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                Groups of 100 or fewer people get the finite population correction below.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-600" />
            Sample size by stakeholder group
          </CardTitle>
          <CardDescription>Population sizes come from each stakeholder&apos;s record</CardDescription>
        </CardHeader>
        <CardContent>
          {stakeholders.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No stakeholders yet"
              action={<Button onClick={() => setActiveSemaModule('stakeholders')}>Add stakeholders</Button>}
            >
              Add stakeholder groups with their population sizes to see how many people to survey in each.
            </EmptyState>
          ) : (
            <div className="space-y-6">
              <div className="-mx-6 overflow-x-auto px-6">
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-2 font-medium">Stakeholder</th>
                      <th className="p-2 text-right font-medium">Population</th>
                      <th className="p-2 text-center font-medium">Formula</th>
                      <th className="p-2 text-center font-medium">Priority</th>
                      <th className="p-2 text-right font-medium">Sample</th>
                      <th className="p-2 text-right font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ stakeholder: s, size, formula, rate }) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="p-2">
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{[s.category, s.stakeholder_type].filter(Boolean).join(' / ')}</p>
                        </td>
                        <td className={cn('p-2 text-right tabular-nums', s.population_size === 0 && 'italic text-muted-foreground')}>
                          {s.population_size === 0 ? 'Unknown' : s.population_size.toLocaleString()}
                        </td>
                        <td className="p-2 text-center">
                          <Badge variant={formula === 'finite' ? 'default' : 'outline'} className="text-xs capitalize">
                            {formula}
                          </Badge>
                        </td>
                        <td className="p-2 text-center">
                          {s.is_priority ? (
                            <Badge className="border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-200">Priority</Badge>
                          ) : (
                            <Badge variant="outline">Standard</Badge>
                          )}
                        </td>
                        <td className="p-2 text-right text-lg font-bold tabular-nums text-sky-700 dark:text-sky-300">{size}</td>
                        <td className={cn('p-2 text-right tabular-nums', rate === null && 'text-muted-foreground')}>
                          {rate === null ? 'n/a' : `${Math.min(100, rate).toFixed(1)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-4 rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-900 dark:bg-green-950/50 sm:grid-cols-3">
                <div>
                  <div className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-300">
                    {unknownPopulation ? 'Partly unknown' : totalPopulation.toLocaleString()}
                  </div>
                  <p className="text-sm text-green-800 dark:text-green-300">Total population</p>
                </div>
                <div>
                  <div className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-300">{totalSample.toLocaleString()}</div>
                  <p className="text-sm text-green-800 dark:text-green-300">Total respondents needed</p>
                </div>
                <div>
                  <div className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-300">{stakeholders.filter((s) => s.is_priority).length}</div>
                  <p className="text-sm text-green-800 dark:text-green-300">Priority groups</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!isDemo && (
        <HcsTransactionDisplay
          transaction={latestSampleParamsHcsTx}
          title="Sample parameters audit log"
          description="Latest sample parameter change logged to Hedera Consensus Service"
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Method</CardTitle>
          <CardDescription>How the sample sizes are calculated</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-sky-50 p-4 dark:bg-sky-950/40">
              <h4 className="mb-3 font-semibold text-sky-900 dark:text-sky-100">Large or unknown populations</h4>
              <code className="block rounded-md bg-background p-3 font-mono text-sm text-sky-700 dark:text-sky-300">n₀ = (Z² × p × (1 - p)) / E²</code>
              <p className="mt-3 text-sm text-sky-900/80 dark:text-sky-200/80">
                Used for groups larger than 100 people or of unknown size. It is the conservative choice.
              </p>
            </div>
            <div className="rounded-lg border bg-emerald-50 p-4 dark:bg-emerald-950/40">
              <h4 className="mb-3 font-semibold text-emerald-900 dark:text-emerald-100">Finite population correction</h4>
              <code className="block rounded-md bg-background p-3 font-mono text-sm text-emerald-700 dark:text-emerald-300">n = (n₀ × N) / (N + n₀ - 1)</code>
              <p className="mt-3 text-sm text-emerald-900/80 dark:text-emerald-200/80">
                Used for groups of 100 or fewer. Z is the z-score for the confidence level, p the expected proportion, E the margin of error and N the group size.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SampleSizeCalculator() {
  const { activeClient, isLoading, sampleParameters } = useSema();

  if (isLoading) return <ModuleSkeleton rows={2} />;
  if (!activeClient) {
    return (
      <Card>
        <EmptyState icon={Calculator} title="No organization selected">
          Select an organization to calculate sample sizes.
        </EmptyState>
      </Card>
    );
  }

  // Re-initialize the form whenever the saved parameters or the organization change.
  return <CalculatorBody key={`${activeClient.id}:${sampleParameters?.updated_at ?? 'none'}`} saved={sampleParameters} />;
}
