'use client';

import { AlertTriangle, Factory } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { EmissionData } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatT, inventoryLabel, inventoryPeriod } from './format';
import { formatDate } from '@/lib/format';

/** Inventory picker plus a short view of the selected inventory's total and breakdown. */
export function InventorySummary({
  inventories,
  selected,
  onSelect,
}: {
  inventories: EmissionData[];
  selected: EmissionData;
  onSelect: (id: string) => void;
}) {
  const totalT = Number(selected.total_emissions) / 1000;
  const breakdown = Object.entries(selected.breakdown ?? {})
    .map(([category, kg]) => ({ category, tonnes: Number(kg) / 1000 }))
    .filter((b) => b.tonnes > 0)
    .sort((a, b) => b.tonnes - a.tonnes);
  const scopeTotal = (scope: string) => breakdown.filter((b) => b.category.startsWith(scope)).reduce((sum, b) => sum + b.tonnes, 0);
  const shown = breakdown.slice(0, 6);
  const period = inventoryPeriod(selected);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Factory className="h-5 w-5 text-emerald-600" />
          Inventory
        </CardTitle>
        <CardDescription>The measured emissions the plan is built from</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="inventory-select" className="sr-only">
            Inventory
          </Label>
          <Select value={selected.id} onValueChange={onSelect}>
            <SelectTrigger id="inventory-select" className="text-left">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {inventories.map((inv) => (
                <SelectItem key={inv.id} value={inv.id}>
                  <span className="block max-w-[16rem] truncate sm:max-w-sm">{inventoryLabel(inv)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatT(Number(inv.total_emissions) / 1000)} t CO2e - {inventoryPeriod(inv) ?? formatDate(inv.created_at)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {period && <p className="text-xs text-muted-foreground">Reporting period {period}</p>}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Total', value: totalT },
            { label: 'Scope 1', value: scopeTotal('Scope 1') },
            { label: 'Scope 2', value: scopeTotal('Scope 2') },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-muted/50 px-2 py-3">
              <p className="text-lg font-bold tabular-nums leading-tight">{formatT(item.value)}</p>
              <p className="text-xs text-muted-foreground">{item.label}, t</p>
            </div>
          ))}
        </div>

        {shown.length > 0 ? (
          <div className="space-y-2.5">
            {shown.map((b) => (
              <div key={b.category}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-foreground/90" title={b.category}>
                    {b.category}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{formatT(b.tonnes)} t</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className={cn('h-1.5 rounded-full', b.category.startsWith('Scope 2') ? 'bg-sky-500' : 'bg-emerald-500')}
                    style={{ width: `${totalT > 0 ? Math.max(2, (b.tonnes / totalT) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {breakdown.length > shown.length && (
              <p className="text-xs text-muted-foreground">
                +{breakdown.length - shown.length} smaller {breakdown.length - shown.length === 1 ? 'category' : 'categories'}
              </p>
            )}
          </div>
        ) : (
          <p className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This inventory has no emissions to reduce. Pick another or add activity data.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
