import { format, parseISO } from 'date-fns';
import type { InventoryLinePayload, InventoryPayload } from '@/hooks/use-api';
import { catalogKey, computeLine, getCatalogEntry, type CatalogEntry, type LineInput } from '@/lib/emissions/catalog';
import { UNITS, UnitError } from '@/lib/emissions/units';
import type { AiAudit, EmissionData, InventoryLine, InventorySource } from '@/lib/types';

// Pure helpers shared by the upload review, the inventory pages and the calculator.

export const SOURCE_LABELS: Record<InventorySource, string> = {
  ai_extraction: 'AI extraction',
  calculator: 'Calculator',
  upload: 'Spreadsheet',
};

export function catalogLabel(entry: Pick<CatalogEntry, 'scope' | 'category' | 'fuelType'>): string {
  return `${entry.scope} / ${entry.category} / ${entry.fuelType}`;
}

/** Group heading for the catalog picker, e.g. "Scope 1 / Stationary / Liquid Fuels". */
export function catalogGroup(entry: Pick<CatalogEntry, 'scope' | 'category' | 'fuelCategory'>): string {
  return entry.category === entry.fuelCategory ? `${entry.scope} / ${entry.category}` : `${entry.scope} / ${entry.category} / ${entry.fuelCategory}`;
}

export type ComputeResult = { ok: true; line: InventoryLine } | { ok: false; error: string };

/** computeLine that reports problems instead of throwing. */
export function tryComputeLine(input: LineInput): ComputeResult {
  try {
    return { ok: true, line: computeLine(input) };
  } catch (error) {
    return { ok: false, error: error instanceof UnitError ? error.message : 'Could not compute this line.' };
  }
}

/** Lines in the current format. Older rows may hold rows from the legacy CSV importer. */
export function inventoryLines(inventory: Pick<EmissionData, 'processed_data'>): InventoryLine[] {
  const lines = Array.isArray(inventory.processed_data) ? inventory.processed_data : [];
  return lines.filter(
    (l): l is InventoryLine =>
      typeof (l as InventoryLine).emissions === 'number' && typeof (l as InventoryLine).fuelType === 'string',
  );
}

/** Turns a stored line back into the payload the API accepts. */
export function lineToPayload(line: InventoryLine): InventoryLinePayload {
  return {
    id: line.id,
    catalogId: catalogKey(line),
    quantity: line.quantity,
    unit: line.unit,
    periodStart: line.periodStart ?? null,
    periodEnd: line.periodEnd ?? null,
    documentId: line.documentId ?? null,
    evidence: line.evidence ?? null,
    confidence: line.confidence ?? null,
    edited: line.edited ?? false,
    description: line.description ?? null,
  };
}

/** The full payload for re-saving an inventory with new lines. */
export function inventoryPayload(inventory: EmissionData, lines: InventoryLinePayload[]): InventoryPayload {
  return {
    source: inventory.source,
    organization: inventory.organization ?? '',
    fileName: inventory.file_name,
    reportingPeriodStart: inventory.reporting_period_start,
    reportingPeriodEnd: inventory.reporting_period_end,
    lines,
    rawData: Array.isArray(inventory.raw_data) ? inventory.raw_data : [],
  };
}

/** True when the audit was run on the inventory's current contents. */
export function isAuditCurrent(audit: Pick<AiAudit, 'created_at'>, inventory: Pick<EmissionData, 'updated_at'>): boolean {
  return Date.parse(audit.created_at) >= Date.parse(inventory.updated_at);
}

export function formatDate(value: string | null | undefined, pattern = 'd MMM yyyy'): string {
  if (!value) return '';
  try {
    return format(parseISO(value), pattern);
  } catch {
    return value;
  }
}

export function formatPeriod(start: string | null | undefined, end: string | null | undefined): string {
  if (!start && !end) return 'No period';
  if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
  return start ? `From ${formatDate(start)}` : `Until ${formatDate(end)}`;
}

export function formatQuantity(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Earliest start and latest end across lines (ISO dates compare as strings). */
export function periodBounds(lines: { periodStart?: string | null; periodEnd?: string | null }[]): { start: string | null; end: string | null } {
  let start: string | null = null;
  let end: string | null = null;
  for (const line of lines) {
    for (const date of [line.periodStart, line.periodEnd]) {
      if (!date) continue;
      if (!start || date < start) start = date;
      if (!end || date > end) end = date;
    }
  }
  return { start, end };
}

const UNIT_ALIASES: Record<string, string> = {
  l: 'litres',
  lt: 'litres',
  ltr: 'litres',
  ltrs: 'litres',
  liter: 'litres',
  liters: 'litres',
  litre: 'litres',
  litres: 'litres',
  kl: 'kL',
  kilolitre: 'kL',
  kilolitres: 'kL',
  kiloliter: 'kL',
  kiloliters: 'kL',
  m3: 'm³',
  'm³': 'm³',
  'cubic metre': 'm³',
  'cubic metres': 'm³',
  'cubic meter': 'm³',
  'cubic meters': 'm³',
  gal: 'US gallons',
  gallon: 'US gallons',
  gallons: 'US gallons',
  'us gal': 'US gallons',
  'us gallon': 'US gallons',
  'us gallons': 'US gallons',
  'imperial gallon': 'imperial gallons',
  'imperial gallons': 'imperial gallons',
  'imp gal': 'imperial gallons',
  ft3: 'cubic feet',
  cf: 'cubic feet',
  'cu ft': 'cubic feet',
  'cubic foot': 'cubic feet',
  'cubic feet': 'cubic feet',
  ccf: 'ccf',
  kg: 'kg',
  kgs: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  t: 'tonnes',
  tonne: 'tonnes',
  tonnes: 'tonnes',
  'metric ton': 'tonnes',
  'metric tons': 'tonnes',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  'short ton': 'short tons',
  'short tons': 'short tons',
  kwh: 'kWh',
  mwh: 'MWh',
  gj: 'GJ',
  mj: 'MJ',
  therm: 'therms',
  therms: 'therms',
  mmbtu: 'mmBtu',
};

/** Maps a unit as written in a spreadsheet ("Liters", "m3", "kwh") to a known unit, or null. */
export function normalizeUnit(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  if (UNITS[text]) return text;
  return UNIT_ALIASES[text.toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '')] ?? null;
}

/** Converts a spreadsheet cell (Date, Excel serial, ISO or other date text) to YYYY-MM-DD, or null. */
export function toIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const fromDate = (d: Date) =>
    Number.isNaN(d.getTime()) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (value instanceof Date) return fromDate(value);
  if (typeof value === 'number') {
    // Excel serial date: days since 1899-12-30.
    if (value < 1 || value > 100000) return null;
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed = new Date(text);
  return fromDate(parsed);
}

/** Parses "1,234.5" or "1 234" to a number. Returns NaN when the cell is not a number. */
export function parseQuantity(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined) return Number.NaN;
  const text = String(value).trim().replace(/[\s,]/g, '');
  if (!text) return Number.NaN;
  return Number(text);
}

export function isCatalogId(id: string | null | undefined): id is string {
  return Boolean(id && getCatalogEntry(id));
}
