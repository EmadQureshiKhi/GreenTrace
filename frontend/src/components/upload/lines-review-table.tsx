'use client';

import { ChevronDown, ChevronRight, FileText, Plus, Trash2 } from 'lucide-react';
import { Fragment, useState } from 'react';
import { ConfidenceBadge, EditedBadge, IssueBadge } from '@/components/inventory/badges';
import { CatalogPicker } from '@/components/inventory/catalog-picker';
import { UnitSelect } from '@/components/inventory/unit-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FactorSourceLink } from '@/components/inventory/factor-source';
import { getCatalogEntry } from '@/lib/emissions/catalog';
import { formatKg } from '@/lib/format';
import { cn } from '@/lib/utils';
import { evaluateDraft, isEdited, type DraftLine } from './draft-lines';

interface LinesReviewTableProps {
  lines: DraftLine[];
  onChange: (key: string, patch: Partial<DraftLine>) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
  /** Show the AI columns (confidence, evidence). */
  ai?: boolean;
}

/** Editable review table of activity lines with live emissions per line. */
export function LinesReviewTable({ lines, onChange, onRemove, onAdd, ai = false }: LinesReviewTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const columns = ai ? 8 : 7;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-2 py-2.5" aria-label="Details" />
              <th className="px-2 py-2.5 font-medium">Source</th>
              <th className="px-2 py-2.5 font-medium">Quantity</th>
              <th className="px-2 py-2.5 font-medium">Unit</th>
              <th className="px-2 py-2.5 font-medium">Period</th>
              {ai && <th className="px-2 py-2.5 font-medium">Confidence</th>}
              <th className="px-2 py-2.5 text-right font-medium">Emissions</th>
              <th className="w-12 px-2 py-2.5" aria-label="Remove" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.length === 0 && (
              <tr>
                <td colSpan={columns} className="px-4 py-10 text-center text-muted-foreground">
                  No lines yet. Add one manually or upload a file.
                </td>
              </tr>
            )}
            {lines.map((line) => {
              const result = evaluateDraft(line);
              const edited = isEdited(line);
              const open = expanded.has(line.key);
              const entry = line.catalogId ? getCatalogEntry(line.catalogId) : undefined;
              const hasDetails = Boolean(entry || line.evidence || line.description || line.reasoning || line.fileName || line.sourceRow);
              return (
                <Fragment key={line.key}>
                  <tr className={cn('align-top', !result.ok && 'bg-red-50/60 dark:bg-red-950/20')}>
                    <td className="px-2 py-3">
                      {hasDetails && (
                        <button
                          type="button"
                          onClick={() => toggle(line.key)}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label={open ? 'Hide details' : 'Show details'}
                          aria-expanded={open}
                        >
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <div className="w-[240px] space-y-1.5">
                        <CatalogPicker
                          value={line.catalogId}
                          invalid={!line.catalogId}
                          onChange={(entry) =>
                            onChange(line.key, {
                              catalogId: entry.id,
                              unit: entry.units.includes(line.unit) ? line.unit : entry.nativeUnit,
                            })
                          }
                        />
                        <div className="flex flex-wrap gap-1">
                          {edited && <EditedBadge />}
                          {line.issue && !result.ok && (
                            <IssueBadge className="whitespace-normal">{line.issue}</IssueBadge>
                          )}
                          {line.sourceRow !== null && (
                            <span className="text-xs text-muted-foreground">Row {line.sourceRow}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <Input
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(e) => onChange(line.key, { quantity: e.target.value })}
                        className={cn('w-28 text-right tabular-nums', line.quantity.trim() !== '' && !Number.isFinite(Number(line.quantity)) && 'border-red-500')}
                        aria-label="Quantity"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <UnitSelect
                        catalogId={line.catalogId}
                        value={line.unit}
                        onChange={(unit) => onChange(line.key, { unit })}
                        className="w-36"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex w-[150px] flex-col gap-1.5">
                        <Input
                          type="date"
                          value={line.periodStart}
                          onChange={(e) => onChange(line.key, { periodStart: e.target.value })}
                          className="h-9 px-2 text-xs dark:[color-scheme:dark]"
                          aria-label="Period start"
                        />
                        <Input
                          type="date"
                          value={line.periodEnd}
                          onChange={(e) => onChange(line.key, { periodEnd: e.target.value })}
                          className="h-9 px-2 text-xs dark:[color-scheme:dark]"
                          aria-label="Period end"
                        />
                      </div>
                    </td>
                    {ai && (
                      <td className="px-2 py-3 pt-5">
                        <ConfidenceBadge confidence={line.confidence} />
                      </td>
                    )}
                    <td className="px-2 py-3 pt-5 text-right">
                      {result.ok ? (
                        <span className="whitespace-nowrap font-medium tabular-nums">{formatKg(result.line.emissions)}</span>
                      ) : (
                        <div className="ml-auto w-36 text-right">
                          <span className="whitespace-nowrap text-xs font-semibold text-red-600 dark:text-red-400">Needs fixing</span>
                          <p className="text-xs text-red-600/90 dark:text-red-400/90">{result.error}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <Button variant="ghost" size="icon" onClick={() => onRemove(line.key)} aria-label="Remove line">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                  {open && hasDetails && (
                    <tr className="bg-muted/30">
                      <td />
                      <td colSpan={columns - 1} className="px-2 pb-4 pt-1">
                        <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-[auto_1fr]">
                          {entry && (
                            <>
                              <dt className="font-medium text-muted-foreground">Emission factor</dt>
                              <dd className="tabular-nums">
                                {entry.factor.toLocaleString(undefined, { maximumFractionDigits: 5 })} kg CO2e/{entry.nativeUnit}
                                {entry.source && (
                                  <>
                                    {', '}
                                    <FactorSourceLink source={entry.source} />
                                    <span className="text-muted-foreground">
                                      {' '}
                                      ({entry.source.dataYear} data, {entry.source.gas === 'CO2' ? 'CO2 only' : 'CO2e'}, {entry.source.boundary})
                                    </span>
                                  </>
                                )}
                              </dd>
                            </>
                          )}
                          {line.fileName && (
                            <>
                              <dt className="font-medium text-muted-foreground">Document</dt>
                              <dd className="flex items-center gap-1.5 break-all">
                                <FileText className="h-3.5 w-3.5 shrink-0" />
                                <span>
                                  {line.fileName}
                                  {line.page !== null && <span className="text-muted-foreground">, page {line.page}</span>}
                                </span>
                              </dd>
                            </>
                          )}
                          {line.description && (
                            <>
                              <dt className="font-medium text-muted-foreground">{ai ? 'Line on the bill' : 'Activity'}</dt>
                              <dd className="break-words">{line.description}</dd>
                            </>
                          )}
                          {line.evidence && (
                            <>
                              <dt className="font-medium text-muted-foreground">Evidence</dt>
                              <dd>
                                <blockquote className="break-words border-l-2 border-violet-400 pl-2 font-mono text-[11px] leading-relaxed">
                                  &ldquo;{line.evidence}&rdquo;
                                </blockquote>
                              </dd>
                            </>
                          )}
                          {line.reasoning && (
                            <>
                              <dt className="font-medium text-muted-foreground">AI reasoning</dt>
                              <dd className="break-words">{line.reasoning}</dd>
                            </>
                          )}
                          {line.original && edited && (
                            <>
                              <dt className="font-medium text-muted-foreground">AI read</dt>
                              <dd className="break-words">
                                {line.original.quantity} {line.original.unit}
                                {line.original.periodStart || line.original.periodEnd
                                  ? `, ${line.original.periodStart ?? '?'} to ${line.original.periodEnd ?? '?'}`
                                  : ''}
                              </dd>
                            </>
                          )}
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus className="mr-2 h-4 w-4" />
        Add line manually
      </Button>
    </div>
  );
}
