'use client';

import { AlertCircle, Download, FileSpreadsheet, Loader2, Trash2, Upload, Wand2 } from 'lucide-react';
import Papa from 'papaparse';
import { useCallback, useMemo, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { CatalogPicker } from '@/components/inventory/catalog-picker';
import { catalogLabel, formatBytes, normalizeUnit, parseQuantity, toIsoDate } from '@/components/inventory/inventory-utils';
import { UnitSelect } from '@/components/inventory/unit-select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { catalog, getCatalogEntry } from '@/lib/emissions/catalog';
import { errorMessage } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CreateInventoryPanel } from './create-inventory-panel';
import { evaluateDraft, manualDraft, type DraftLine } from './draft-lines';
import { LinesReviewTable } from './lines-review-table';

type Row = Record<string, unknown>;

interface ParsedSheet {
  fileName: string;
  fileSize: number;
  sheetNames: string[];
  sheet: string | null;
  headers: string[];
  rows: Row[];
  /** Kept so another worksheet can be chosen without re-reading the file. */
  workbook: XLSX.WorkBook | null;
}

type ColumnRole = 'activity' | 'quantity' | 'unit' | 'start' | 'end';
type ColumnMap = Record<ColumnRole, string | null>;

interface ActivityMapping {
  catalogId: string | null;
  unit: string;
  suggested: boolean;
}

const NONE = '__none__';
const MAX_LINES = 2000;

const ROLE_LABELS: Record<ColumnRole, { label: string; required: boolean; hint: string }> = {
  activity: { label: 'Activity', required: true, hint: 'What was consumed, e.g. "Diesel - generators"' },
  quantity: { label: 'Quantity', required: true, hint: 'The amount consumed, not the cost' },
  unit: { label: 'Unit', required: false, hint: 'Optional. Otherwise set a unit per activity' },
  start: { label: 'Period start or date', required: false, hint: 'Optional' },
  end: { label: 'Period end', required: false, hint: 'Optional' },
};

const HEADER_PATTERNS: Record<ColumnRole, RegExp> = {
  activity: /activity|description|fuel|source|item|type|category|service/i,
  quantity: /quantity|amount|consumption|usage|volume|qty|value|used/i,
  unit: /^units?$|unit of|uom|measure/i,
  start: /start|from|^date$|period|month/i,
  end: /end|to$|until/i,
};

/** Exact headings win over loose matches, so "Category, Activity" maps Activity, not Category. */
const PREFERRED: Record<ColumnRole, RegExp> = {
  activity: /^(activity|description|fuel|fuel type|source|emission source)$/i,
  quantity: /^(quantity|amount|consumption|usage|qty)$/i,
  unit: /^units?$/i,
  start: /^(period start|start date|start|from|date)$/i,
  end: /^(period end|end date|end|to)$/i,
};

function guessColumns(headers: string[]): ColumnMap {
  const used = new Set<string>();
  const pick = (role: ColumnRole) => {
    const header =
      headers.find((h) => !used.has(h) && PREFERRED[role].test(h)) ?? headers.find((h) => !used.has(h) && HEADER_PATTERNS[role].test(h));
    if (header) used.add(header);
    return header ?? null;
  };
  // Order matters: specific roles first so "Unit" is not taken as the activity.
  const unit = pick('unit');
  const quantity = pick('quantity');
  const end = pick('end');
  const start = pick('start');
  const activity = pick('activity');
  return { activity, quantity, unit, start, end };
}

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Suggests a catalog entry only when the activity names one unambiguously. */
function suggestCatalogId(activity: string): string | null {
  const a = norm(activity);
  if (!a) return null;
  const byId = getCatalogEntry(activity.trim());
  if (byId) return byId.id;
  const exact = catalog.filter((e) => norm(e.fuelType) === a || norm(catalogLabel(e)) === a || norm(`${e.category} ${e.fuelType}`) === a);
  if (exact.length === 1) return exact[0].id;
  if (/^(grid )?electricity( consumption| usage| use)?$/.test(a) || a === 'grid electricity') {
    return catalog.find((e) => e.scope === 'Scope 2' && e.category === 'Electricity' && /grid/i.test(e.fuelType))?.id ?? null;
  }
  return null;
}

async function parseFile(file: File): Promise<ParsedSheet> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    const text = await file.text();
    const result = Papa.parse<Row>(text, { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() });
    const delimiterError = result.errors.find((e) => e.type === 'Delimiter');
    if (delimiterError) throw new Error(`Could not read the CSV: ${delimiterError.message}`);
    const headers = (result.meta.fields ?? []).filter(Boolean);
    return { fileName: file.name, fileSize: file.size, sheetNames: [], sheet: null, headers, rows: result.data, workbook: null };
  }
  if (ext === 'xlsx' || ext === 'xls') {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const sheet = workbook.SheetNames[0];
    if (!sheet) throw new Error('The workbook has no worksheets.');
    return { fileName: file.name, fileSize: file.size, sheetNames: workbook.SheetNames, ...readSheet(workbook, sheet), workbook };
  }
  throw new Error('Upload a CSV or Excel file (.csv, .xlsx, .xls).');
}

function readSheet(workbook: XLSX.WorkBook, sheet: string): { sheet: string; headers: string[]; rows: Row[] } {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, defval: '', blankrows: false, raw: true });
  const headerIndex = matrix.findIndex((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
  if (headerIndex === -1) return { sheet, headers: [], rows: [] };
  const rawHeaders = matrix[headerIndex].map((cell) => String(cell ?? '').trim());
  const headers = rawHeaders.filter(Boolean);
  const rows = matrix
    .slice(headerIndex + 1)
    .map((cells) => {
      const row: Row = {};
      rawHeaders.forEach((header, i) => {
        if (header) row[header] = cells[i] ?? '';
      });
      return row;
    })
    .filter((row) => Object.values(row).some((v) => String(v ?? '').trim() !== ''));
  return { sheet, headers, rows };
}

const cellText = (value: unknown) => (value instanceof Date ? (toIsoDate(value) ?? '') : String(value ?? '').trim());

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([['Activity', 'Quantity', 'Unit', 'Period start', 'Period end']]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Activity data');
  XLSX.writeFile(wb, 'greentrace-activity-template.xlsx');
}

export function SpreadsheetImport() {
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnMap>({ activity: null, quantity: null, unit: null, start: null, end: null });
  const [mappings, setMappings] = useState<Record<string, ActivityMapping>>({});
  const [lines, setLines] = useState<DraftLine[] | null>(null);

  const resetFor = useCallback((sheet: Pick<ParsedSheet, 'headers'>) => {
    setColumns(guessColumns(sheet.headers));
    setMappings({});
    setLines(null);
  }, []);

  const onDrop = useCallback(
    async (accepted: File[], rejected: FileRejection[]) => {
      setError(null);
      if (rejected.length > 0) {
        const code = rejected[0].errors[0]?.code;
        setError(code === 'file-too-large' ? 'The file is larger than 10 MB.' : 'Upload a CSV or Excel file (.csv, .xlsx, .xls).');
        return;
      }
      const file = accepted[0];
      if (!file) return;
      setParsing(true);
      try {
        const sheet = await parseFile(file);
        if (sheet.headers.length === 0 || sheet.rows.length === 0) throw new Error('No rows found. The first row should hold column headings.');
        setParsed(sheet);
        resetFor(sheet);
      } catch (e) {
        setParsed(null);
        setError(errorMessage(e));
      } finally {
        setParsing(false);
      }
    },
    [resetFor],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    multiple: false,
    maxSize: 10 * 1024 * 1024,
  });

  const chooseSheet = (sheetName: string) => {
    if (!parsed?.workbook) return;
    const sheet = readSheet(parsed.workbook, sheetName);
    setParsed({ ...parsed, ...sheet });
    resetFor(sheet);
  };

  // Distinct activities with their row counts.
  const activities = useMemo(() => {
    if (!parsed || !columns.activity) return [];
    const counts = new Map<string, number>();
    for (const row of parsed.rows) {
      const key = cellText(row[columns.activity]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
  }, [parsed, columns.activity]);

  const mappingFor = (name: string): ActivityMapping => {
    const existing = mappings[name];
    if (existing) return existing;
    const suggested = suggestCatalogId(name);
    return { catalogId: suggested, unit: suggested ? (getCatalogEntry(suggested)?.nativeUnit ?? '') : '', suggested: Boolean(suggested) };
  };

  const setMapping = (name: string, patch: Partial<ActivityMapping>) =>
    setMappings((prev) => ({ ...prev, [name]: { ...mappingFor(name), ...patch, suggested: false } }));

  const unmappedActivities = activities.filter((a) => !mappingFor(a.name).catalogId).length;
  const tooMany = (parsed?.rows.length ?? 0) > MAX_LINES;

  const buildLines = () => {
    if (!parsed || !columns.activity || !columns.quantity) return;
    const built = parsed.rows.map((row, index) => {
      const activity = cellText(row[columns.activity!]);
      const mapping = mappingFor(activity);
      const entry = mapping.catalogId ? getCatalogEntry(mapping.catalogId) : undefined;
      const rawQuantity = row[columns.quantity!];
      const quantity = parseQuantity(rawQuantity);
      const rawUnit = columns.unit ? cellText(row[columns.unit]) : '';
      const unit = rawUnit ? normalizeUnit(rawUnit) : mapping.unit || null;
      const issues: string[] = [];
      if (!entry) issues.push(activity ? `"${activity}" is not mapped to an emission source.` : 'The activity cell is empty.');
      if (!Number.isFinite(quantity)) issues.push(`Quantity "${cellText(rawQuantity)}" is not a number.`);
      if (rawUnit && !unit) issues.push(`Unit "${rawUnit}" is not recognised.`);
      else if (!unit) issues.push('No unit.');
      else if (entry && !entry.units.includes(unit)) issues.push(`${unit} cannot be used for ${entry.fuelType}.`);
      const start = columns.start ? toIsoDate(row[columns.start]) : null;
      const end = columns.end ? toIsoDate(row[columns.end]) : null;
      return manualDraft({
        id: `row-${index + 1}`,
        catalogId: entry?.id ?? null,
        quantity: Number.isFinite(quantity) ? String(quantity) : cellText(rawQuantity),
        unit: unit ?? '',
        periodStart: start ?? '',
        periodEnd: end ?? (columns.end ? '' : (start ?? '')),
        description: activity || null,
        issue: issues.length ? issues.join(' ') : null,
        sourceRow: index + 1,
      });
    });
    setLines(built);
  };

  const failing = lines ? lines.filter((l) => !evaluateDraft(l).ok).length : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import a spreadsheet
          </CardTitle>
          <CardDescription>
            One row per activity with a quantity and unit. You map each activity to an emission source; emissions are calculated from the factor catalog.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              'cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors sm:p-8',
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
              parsing && 'pointer-events-none opacity-50',
            )}
          >
            <input {...getInputProps()} />
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              {parsing ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-primary" />}
            </div>
            <p className="font-medium">{isDragActive ? 'Drop the file here' : parsed ? 'Drop another file to replace it' : 'Drop a CSV or Excel file here, or click to browse'}</p>
            <p className="mt-1 text-sm text-muted-foreground">.csv, .xlsx or .xls up to 10 MB, first row as headings.</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {parsed ? (
              <p className="min-w-0 text-sm">
                <span className="font-medium">{parsed.fileName}</span>{' '}
                <span className="text-muted-foreground">
                  ({formatBytes(parsed.fileSize)}, {parsed.rows.length} {parsed.rows.length === 1 ? 'row' : 'rows'})
                </span>
              </p>
            ) : (
              <span />
            )}
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Download template
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {tooMany && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                An inventory holds at most {MAX_LINES.toLocaleString()} lines. Split the file or aggregate rows (for example monthly per source).
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Map columns</CardTitle>
            <CardDescription>Tell GreenTrace which column holds what. Columns were guessed from their headings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.sheetNames.length > 1 && (
              <div className="max-w-xs space-y-2">
                <Label>Worksheet</Label>
                <Select value={parsed.sheet ?? undefined} onValueChange={chooseSheet}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {parsed.sheetNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {(Object.keys(ROLE_LABELS) as ColumnRole[]).map((role) => (
                <div key={role} className="min-w-0 space-y-2">
                  <Label>
                    {ROLE_LABELS[role].label}
                    {ROLE_LABELS[role].required && <span className="text-red-600"> *</span>}
                  </Label>
                  <Select
                    value={columns[role] ?? NONE}
                    onValueChange={(value) => {
                      setColumns((prev) => ({ ...prev, [role]: value === NONE ? null : value }));
                      if (role === 'activity') setMappings({});
                    }}
                  >
                    <SelectTrigger className={cn(ROLE_LABELS[role].required && !columns[role] && 'border-red-500')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{ROLE_LABELS[role].required ? 'Choose a column' : 'Not in the file'}</SelectItem>
                      {parsed.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[role].hint}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {parsed && columns.activity && columns.quantity && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Map activities to emission sources</CardTitle>
            <CardDescription>
              {activities.length} distinct {activities.length === 1 ? 'activity' : 'activities'} in the &quot;{columns.activity}&quot; column.
              {columns.unit ? ' The unit column is used where it is filled in; the unit here covers empty cells.' : ' Pick the unit the quantities are in.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Activity in file</th>
                    <th className="px-3 py-2.5 text-right font-medium">Rows</th>
                    <th className="px-3 py-2.5 font-medium">Emission source</th>
                    <th className="px-3 py-2.5 font-medium">Default unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activities.map(({ name, count }) => {
                    const mapping = mappingFor(name);
                    return (
                      <tr key={name} className="align-top">
                        <td className="max-w-[220px] px-3 py-3">
                          <p className="break-words font-medium">{name || <span className="italic text-muted-foreground">(empty)</span>}</p>
                          {mapping.suggested && (
                            <span className="mt-1 inline-flex items-center gap-1 text-xs text-violet-700 dark:text-violet-300">
                              <Wand2 className="h-3 w-3" />
                              Suggested from the name, please check
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{count}</td>
                        <td className="px-3 py-3">
                          <CatalogPicker
                            value={mapping.catalogId}
                            invalid={!mapping.catalogId}
                            className="w-[260px]"
                            onChange={(entry) =>
                              setMapping(name, { catalogId: entry.id, unit: entry.units.includes(mapping.unit) ? mapping.unit : entry.nativeUnit })
                            }
                          />
                        </td>
                        <td className="px-3 py-3">
                          <UnitSelect catalogId={mapping.catalogId} value={mapping.unit} onChange={(unit) => setMapping(name, { unit })} className="w-36" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {unmappedActivities > 0
                  ? `${unmappedActivities} ${unmappedActivities === 1 ? 'activity is' : 'activities are'} not mapped yet. Their rows will be flagged.`
                  : 'Every activity is mapped.'}
              </p>
              <Button onClick={buildLines} disabled={tooMany} className="w-full sm:w-auto">
                {lines ? 'Rebuild lines from mapping' : `Build ${parsed.rows.length} ${parsed.rows.length === 1 ? 'line' : 'lines'}`}
              </Button>
            </div>
            {lines && <p className="text-xs text-muted-foreground">Rebuilding replaces any edits made in the review below.</p>}
          </CardContent>
        </Card>
      )}

      {parsed && lines && (
        <Card>
          <CardHeader className="sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="text-lg">Review lines</CardTitle>
              <CardDescription>Rows that could not be mapped are flagged. Fix them here or remove them.</CardDescription>
            </div>
            {failing > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 sm:mt-0"
                onClick={() => setLines((prev) => (prev ? prev.filter((l) => evaluateDraft(l).ok) : prev))}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove {failing} flagged {failing === 1 ? 'row' : 'rows'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <LinesReviewTable
              lines={lines}
              onChange={(key, patch) => setLines((prev) => (prev ? prev.map((l) => (l.key === key ? { ...l, ...patch } : l)) : prev))}
              onRemove={(key) => setLines((prev) => (prev ? prev.filter((l) => l.key !== key) : prev))}
              onAdd={() => setLines((prev) => [...(prev ?? []), manualDraft()])}
            />
          </CardContent>
        </Card>
      )}

      {parsed && lines && (
        <CreateInventoryPanel
          lines={lines}
          source="upload"
          fileName={parsed.sheet && parsed.sheetNames.length > 1 ? `${parsed.fileName} (${parsed.sheet})` : parsed.fileName}
          rawData={parsed.rows.slice(0, 5000)}
          blocker={lines.length > MAX_LINES ? `An inventory holds at most ${MAX_LINES} lines.` : null}
        />
      )}
    </div>
  );
}
