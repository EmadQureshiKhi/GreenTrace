'use client';

import { Flag, Loader2, Pencil, Trash2, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSaveInventory } from '@/hooks/use-api';
import { toast } from '@/hooks/use-toast';
import { catalogKey, lineFactorSource } from '@/lib/emissions/catalog';
import { errorMessage, formatKg } from '@/lib/format';
import type { DocumentRecord, EmissionData, FindingSeverity, InventoryLine } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ConfidenceBadge, EditedBadge, SeverityBadge } from './badges';
import { FactorSourceLink } from './factor-source';
import { formatDate, formatQuantity, inventoryPayload, lineToPayload, tryComputeLine } from './inventory-utils';
import { UnitSelect } from './unit-select';

export interface LineFlag {
  severity: FindingSeverity;
  titles: string[];
}

interface InventoryLinesProps {
  inventory: EmissionData;
  lines: InventoryLine[];
  documents: DocumentRecord[];
  /** Lines referenced by the latest audit's findings. */
  flags: Map<string, LineFlag>;
  editable: boolean;
  /** Rows in processed_data that are not in the current line format. */
  legacyRows: number;
}

const FLAG_ROW: Record<FindingSeverity, string> = {
  high: 'bg-red-50 dark:bg-red-950/30 shadow-[inset_3px_0_0_0_theme(colors.red.500)]',
  medium: 'bg-amber-50 dark:bg-amber-950/30 shadow-[inset_3px_0_0_0_theme(colors.amber.500)]',
  low: 'bg-sky-50 dark:bg-sky-950/30 shadow-[inset_3px_0_0_0_theme(colors.sky.500)]',
  info: 'bg-muted/40 shadow-[inset_3px_0_0_0_theme(colors.slate.400)]',
};

interface Draft {
  quantity: string;
  unit: string;
}

export function InventoryLines({ inventory, lines, documents, flags, editable, legacyRows }: InventoryLinesProps) {
  const save = useSaveInventory();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const documentNames = useMemo(() => new Map(documents.map((d) => [d.id, d.file_name])), [documents]);

  const evaluate = (line: InventoryLine) => {
    const draft = drafts[line.id];
    if (!draft) return { ok: true as const, line };
    if (draft.quantity.trim() === '') return { ok: false as const, error: 'Enter a quantity.' };
    return tryComputeLine({ id: line.id, catalogId: catalogKey(line), quantity: Number(draft.quantity), unit: draft.unit });
  };

  const kept = lines.filter((l) => !removed.has(l.id));
  const errors = kept.map(evaluate).filter((r) => !r.ok).length;
  const changed =
    removed.size > 0 ||
    Object.entries(drafts).some(([id, d]) => {
      const line = lines.find((l) => l.id === id);
      return line && (Number(d.quantity) !== line.quantity || d.unit !== line.unit);
    });

  const cancel = () => {
    setEditing(false);
    setDrafts({});
    setRemoved(new Set());
  };

  const setDraft = (line: InventoryLine, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [line.id]: { ...(prev[line.id] ?? { quantity: String(line.quantity), unit: line.unit }), ...patch } }));

  const toggleRemoved = (id: string) =>
    setRemoved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    const payloadLines = kept.map((line) => {
      const base = lineToPayload(line);
      const draft = drafts[line.id];
      if (!draft) return base;
      const quantity = Number(draft.quantity);
      const differs = quantity !== line.quantity || draft.unit !== line.unit;
      const readByAi = Boolean(line.documentId) || (line.confidence !== null && line.confidence !== undefined);
      return { ...base, quantity, unit: draft.unit, edited: Boolean(base.edited) || (readByAi && differs) };
    });
    try {
      await save.mutateAsync({ id: inventory.id, payload: inventoryPayload(inventory, payloadLines) });
      toast({ title: 'Inventory saved', description: 'Totals were recalculated. Run the audit again before certifying.' });
      cancel();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not save the inventory', description: errorMessage(error) });
    }
  };

  const columns = editing ? 9 : 8;

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-lg">Activity lines</CardTitle>
          <CardDescription>
            {editing
              ? 'Change quantities and units or remove lines. Saving recalculates the totals and makes the current audit out of date.'
              : 'Each line is quantity x emission factor from the catalog, converted to the factor’s unit.'}
          </CardDescription>
        </div>
        {editable && lines.length > 0 && (
          <div className="flex shrink-0 gap-2">
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={cancel} disabled={save.isPending}>
                  Cancel
                </Button>
                <Button size="sm" onClick={submit} disabled={!changed || errors > 0 || kept.length === 0 || save.isPending}>
                  {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {save.isPending ? 'Saving...' : 'Save changes'}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit lines
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {legacyRows > 0 && (
          <Alert>
            <AlertDescription>
              {legacyRows} {legacyRows === 1 ? 'row was' : 'rows were'} saved by an older importer and cannot be shown here. Re-import the data to audit it.
            </AlertDescription>
          </Alert>
        )}
        {editing && kept.length === 0 && (
          <Alert variant="destructive">
            <AlertDescription>An inventory needs at least one line.</AlertDescription>
          </Alert>
        )}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Source</th>
                <th className="px-3 py-2.5 text-right font-medium">Quantity</th>
                <th className="px-3 py-2.5 text-right font-medium">In factor unit</th>
                <th className="px-3 py-2.5 text-right font-medium">Factor</th>
                <th className="px-3 py-2.5 text-right font-medium">kg CO2e</th>
                <th className="px-3 py-2.5 font-medium">Period</th>
                <th className="px-3 py-2.5 font-medium">Evidence</th>
                <th className="px-3 py-2.5 font-medium">Review</th>
                {editing && <th className="w-12 px-3 py-2.5" aria-label="Remove" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.length === 0 && (
                <tr>
                  <td colSpan={columns} className="px-4 py-10 text-center text-muted-foreground">
                    This inventory has no lines in the current format.
                  </td>
                </tr>
              )}
              {lines.map((line) => {
                const flag = flags.get(line.id);
                const isRemoved = removed.has(line.id);
                const draft = drafts[line.id];
                const result = evaluate(line);
                const shown = result.ok ? result.line : null;
                return (
                  <tr
                    key={line.id}
                    id={`line-${line.id}`}
                    className={cn('scroll-mt-24 align-top', flag && FLAG_ROW[flag.severity], isRemoved && 'opacity-40')}
                  >
                    <td className="px-3 py-3">
                      <div className="w-[220px]">
                        <p className="font-medium">{line.fuelType}</p>
                        <p className="text-xs text-muted-foreground">
                          {line.scope} / {line.category}
                        </p>
                        {line.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={line.description}>
                            {line.description}
                          </p>
                        )}
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">{line.id}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {editing && !isRemoved ? (
                        <div className="ml-auto flex w-[230px] items-start justify-end gap-2">
                          <Input
                            inputMode="decimal"
                            value={draft?.quantity ?? String(line.quantity)}
                            onChange={(e) => setDraft(line, { quantity: e.target.value })}
                            className="h-9 w-24 text-right tabular-nums"
                            aria-label="Quantity"
                          />
                          <UnitSelect
                            catalogId={catalogKey(line)}
                            value={draft?.unit ?? line.unit}
                            onChange={(unit) => setDraft(line, { unit })}
                            className="h-9 w-32"
                          />
                        </div>
                      ) : (
                        <span className="whitespace-nowrap tabular-nums">
                          {formatQuantity(line.quantity)} {line.unit}
                        </span>
                      )}
                      {!result.ok && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{result.error}</p>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {shown ? `${formatQuantity(shown.nativeQuantity)} ${shown.nativeUnit}` : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {line.factor.toLocaleString(undefined, { maximumFractionDigits: 5 })}
                      <span className="text-xs"> /{line.nativeUnit}</span>
                      <FactorSourceLink source={lineFactorSource(line)} className="mt-0.5 block" />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">{shown ? formatKg(shown.emissions) : '-'}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                      {line.periodStart || line.periodEnd ? (
                        <>
                          {formatDate(line.periodStart) || '?'}
                          <br />
                          {formatDate(line.periodEnd) || '?'}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="w-[200px] space-y-1 text-xs">
                        {line.documentId && (
                          <p className="truncate font-medium" title={documentNames.get(line.documentId) ?? line.documentId}>
                            {documentNames.get(line.documentId) ?? 'Source document'}
                          </p>
                        )}
                        {line.evidence ? (
                          <p className="line-clamp-2 font-mono text-[11px] text-muted-foreground" title={line.evidence}>
                            &ldquo;{line.evidence}&rdquo;
                          </p>
                        ) : (
                          !line.documentId && <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex w-[140px] flex-wrap gap-1">
                        {line.confidence !== null && line.confidence !== undefined && <ConfidenceBadge confidence={line.confidence} />}
                        {line.edited && <EditedBadge />}
                        {flag && (
                          <span title={flag.titles.join('\n')} className="inline-flex items-center gap-1">
                            <Flag className="h-3 w-3 text-muted-foreground" />
                            <SeverityBadge severity={flag.severity} />
                          </span>
                        )}
                      </div>
                    </td>
                    {editing && (
                      <td className="px-3 py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => toggleRemoved(line.id)}
                          aria-label={isRemoved ? 'Keep line' : 'Remove line'}
                          title={isRemoved ? 'Keep line' : 'Remove line'}
                        >
                          {isRemoved ? <Undo2 className="h-4 w-4" /> : <Trash2 className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
