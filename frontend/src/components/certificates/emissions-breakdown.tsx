import { BarChart3, ListTree } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatKg, formatTonnes } from '@/lib/format';
import type { InventoryLine } from '@/lib/types';
import { breakdownEntries, formatNumber, formatPeriod } from './certificate-utils';

export function EmissionsBreakdown({ breakdown, totalKg }: { breakdown: Record<string, number>; totalKg: number }) {
  const entries = breakdownEntries(breakdown);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" /> Emissions breakdown
        </CardTitle>
        <CardDescription>Certified emissions by scope and category, in tonnes CO2e.</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No breakdown was recorded for this certificate.</p>
        ) : (
          <ul className="space-y-4">
            {entries.map(({ key, kg }) => {
              const share = totalKg > 0 ? (kg / totalKg) * 100 : 0;
              const scope2 = key.startsWith('Scope 2');
              return (
                <li key={key} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 break-words font-medium">{key}</span>
                    <span className="shrink-0 tabular-nums" title={formatKg(kg)}>
                      {formatTonnes(kg)} <span className="text-muted-foreground">({formatNumber(share, 1)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={scope2 ? 'h-full rounded-full bg-sky-500 dark:bg-sky-400' : 'h-full rounded-full bg-emerald-600 dark:bg-emerald-500'}
                      style={{ width: `${Math.max(share, 0.5)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ActivityLines({ lines, available }: { lines: InventoryLine[]; available: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ListTree className="h-5 w-5 text-primary" /> Activity data
        </CardTitle>
        <CardDescription>The inventory lines this certificate attests to. Their hash is the one recorded on Hedera.</CardDescription>
      </CardHeader>
      <CardContent>
        {!available ? (
          <p className="text-sm text-muted-foreground">The underlying inventory is no longer available.</p>
        ) : lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">This inventory has no activity lines in the current format.</p>
        ) : (
          <div className="-mx-6 overflow-x-auto px-6">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Source</th>
                  <th className="pb-2 pr-4 font-medium">Fuel</th>
                  <th className="pb-2 pr-4 text-right font-medium">Quantity</th>
                  <th className="pb-2 pr-4 text-right font-medium">kg CO2e</th>
                  <th className="pb-2 pr-4 font-medium">Period</th>
                  <th className="pb-2 font-medium">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...lines]
                  .sort((a, b) =>
                    `${a.scope}|${a.category}|${a.fuelType}|${a.periodStart ?? ''}`.localeCompare(`${b.scope}|${b.category}|${b.fuelType}|${b.periodStart ?? ''}`),
                  )
                  .map((line) => (
                  <tr key={line.id} className="align-top">
                    <td className="py-2.5 pr-4">
                      <div className="font-medium">{line.scope}</div>
                      <div className="text-xs text-muted-foreground">{line.category}</div>
                    </td>
                    <td className="py-2.5 pr-4">
                      <div>{line.fuelType}</div>
                      {line.fuelCategory && <div className="text-xs text-muted-foreground">{line.fuelCategory}</div>}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-right tabular-nums">
                      {formatNumber(line.quantity)} <span className="text-muted-foreground">{line.unit}</span>
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-right font-medium tabular-nums">{formatNumber(line.emissions, 1)}</td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-muted-foreground">
                      {line.periodStart || line.periodEnd ? formatPeriod(line.periodStart, line.periodEnd) : '-'}
                    </td>
                    <td className="max-w-[16rem] py-2.5 text-xs text-muted-foreground">
                      {line.evidence ? (
                        <span className="line-clamp-2 italic" title={line.evidence}>
                          &ldquo;{line.evidence}&rdquo;
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
