import { CalendarRange, FileText, Layers, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatKg, formatTonnes } from '@/lib/format';
import type { EmissionData } from '@/lib/types';
import { SourceBadge } from './badges';
import { DeleteDraftButton } from './delete-draft-button';
import { formatDate, formatPeriod } from './inventory-utils';

/** Header of the inventory page: who, when, how much, and where it comes from. */
export function InventorySummary({ inventory, lineCount, certified }: { inventory: EmissionData; lineCount: number; certified: boolean }) {
  const totalKg = Number(inventory.total_emissions);
  const breakdown = Object.entries(inventory.breakdown ?? {})
    .map(([key, kg]) => ({ key, kg: Number(kg) }))
    .filter((b) => Number.isFinite(b.kg))
    .sort((a, b) => b.kg - a.kg);
  const max = Math.max(...breakdown.map((b) => b.kg), 0);

  return (
    <Card>
      <CardContent className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge source={inventory.source} />
              <span className="text-xs text-muted-foreground">Created {formatDate(inventory.created_at)}</span>
            </div>
            <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{inventory.organization || 'Unnamed organization'}</h1>
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarRange className="h-4 w-4 shrink-0" />
                {formatPeriod(inventory.reporting_period_start, inventory.reporting_period_end)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-4 w-4 shrink-0" />
                {lineCount} {lineCount === 1 ? 'activity line' : 'activity lines'}
              </span>
              {inventory.file_name && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate" title={inventory.file_name}>
                    {inventory.file_name}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-950/40">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Total emissions</p>
            <p className="text-3xl font-bold tabular-nums text-emerald-900 dark:text-emerald-50">
              {formatTonnes(totalKg)} <span className="text-base font-medium">CO2e</span>
            </p>
            <p className="text-sm tabular-nums text-emerald-800/80 dark:text-emerald-200/80">{formatKg(totalKg)} CO2e</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link href={`/reduce?inventory=${inventory.id}`}>
                <TrendingDown className="mr-2 h-4 w-4" />
                Plan reductions
              </Link>
            </Button>
            {!certified && <DeleteDraftButton id={inventory.id} />}
          </div>
        </div>

        <div className="min-w-0">
          <h2 className="mb-3 text-sm font-semibold">By scope and category</h2>
          {breakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">No breakdown available.</p>
          ) : (
            <ul className="space-y-3">
              {breakdown.map(({ key, kg }) => {
                const share = totalKg > 0 ? (kg / totalKg) * 100 : 0;
                return (
                  <li key={key} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{key}</span>
                      <span className="shrink-0 tabular-nums">
                        <span className="font-medium">{formatTonnes(kg)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{share.toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={key.startsWith('Scope 2') ? 'h-full rounded-full bg-sky-500' : 'h-full rounded-full bg-emerald-500'}
                        style={{ width: `${max > 0 ? Math.max((kg / max) * 100, kg > 0 ? 1 : 0) : 0}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
