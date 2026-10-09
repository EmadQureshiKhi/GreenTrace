import { initialEmissionFactors } from '@/data/emissionFactors';
import { gridFactors, type GridFactorSource } from '@/data/gridFactors';
import type { InventoryLine } from '@/lib/types';
import { compatibleUnits, convertToNative, NATURAL_GAS_KWH_PER_M3, UnitError, type ConversionOptions } from './units';

// A flat, addressable view of the emission factor database. Each entry has a stable id that the AI
// extractor must choose from, so the model never invents a fuel or a factor.

/** Where a factor comes from. Set for entries read from an official publication (national grids). */
export interface FactorSource extends GridFactorSource {
  /** Gases the factor covers. */
  gas: 'CO2' | 'CO2e';
  /** What one kWh is measured at, in the publisher's terms (generation, consumption, ...). */
  boundary: string;
  /** The year (or fiscal year) the factor describes. */
  dataYear: string;
  note: string | null;
}

export interface CatalogEntry {
  id: string;
  scope: 'Scope 1' | 'Scope 2';
  category: string;
  fuelCategory: string;
  fuelType: string;
  /** kg CO2e per native unit */
  factor: number;
  nativeUnit: string;
  conversion: ConversionOptions;
  /** Units a quantity may be given in for this entry. */
  units: string[];
  /** Country a location-based grid factor applies to (ISO 3166-1 alpha-2, "EU" for the EU-27 average). */
  country: { code: string; name: string; aliases: string[] } | null;
  source: FactorSource | null;
}

/** The generic electricity factor, used when the site's country has no national grid entry. */
export const GENERIC_GRID_ID = 'scope-2-electricity-electricity-grid-average';

/** Stable id of a national grid entry, e.g. scope-2-electricity-grid-gb. */
export function gridEntryId(countryCode: string): string {
  return `scope-2-electricity-grid-${countryCode.toLowerCase()}`;
}

function nativeUnitFor(scope: string, category: string, fuelCategory: string, fuelType: string): string {
  if (scope === 'Scope 2') return 'kWh';
  if (category === 'Fugitive') return 'kg';
  if (fuelCategory === 'Solid Fuels') return 'tonnes';
  if (/natural gas/i.test(fuelType) && !/compressed|liquefied|cng|lng/i.test(fuelType)) return 'm³';
  return 'litres';
}

function slug(...parts: string[]): string {
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildCatalog(): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  const add = (
    scope: 'Scope 1' | 'Scope 2',
    category: string,
    fuelCategory: string,
    fuelType: string,
    factor: number,
    extra: Pick<CatalogEntry, 'id' | 'country' | 'source'> | null = null,
  ) => {
    const nativeUnit = nativeUnitFor(scope, category, fuelCategory, fuelType);
    const conversion: ConversionOptions = nativeUnit === 'm³' ? { kwhPerCubicMetre: NATURAL_GAS_KWH_PER_M3 } : {};
    entries.push({
      id: extra?.id ?? slug(scope, category, fuelCategory, fuelType),
      scope,
      category,
      fuelCategory,
      fuelType,
      factor,
      nativeUnit,
      conversion,
      units: compatibleUnits(nativeUnit, conversion),
      country: extra?.country ?? null,
      source: extra?.source ?? null,
    });
  };

  for (const [category, fuelCategories] of Object.entries(initialEmissionFactors['Scope 1'])) {
    for (const [fuelCategory, fuels] of Object.entries(fuelCategories)) {
      for (const [fuelType, { factor }] of Object.entries(fuels)) add('Scope 1', category, fuelCategory, fuelType, factor);
    }
  }
  for (const [fuelCategory, fuels] of Object.entries(initialEmissionFactors['Scope 2'])) {
    for (const [fuelType, { factor }] of Object.entries(fuels)) add('Scope 2', fuelCategory, fuelCategory, fuelType, factor);
    if (fuelCategory !== 'Electricity') continue;
    // National grids sit with the other electricity sources, after the generic grid average.
    for (const g of gridFactors) {
      add('Scope 2', 'Electricity', 'Electricity', `Grid - ${g.name}`, g.factor, {
        id: gridEntryId(g.code),
        country: { code: g.code, name: g.name, aliases: g.aliases },
        source: { ...g.source, gas: g.gas, boundary: g.boundary, dataYear: g.dataYear, note: g.note },
      });
    }
  }
  return entries;
}

export const catalog: CatalogEntry[] = buildCatalog();

const byId = new Map(catalog.map((entry) => [entry.id, entry]));
const tupleKey = (scope: string, category: string, fuelCategory: string, fuelType: string) =>
  [scope, category, fuelCategory, fuelType].join('\u0000');
const byTuple = new Map<string, CatalogEntry>();
for (const entry of [...catalog].reverse()) byTuple.set(tupleKey(entry.scope, entry.category, entry.fuelCategory, entry.fuelType), entry);

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return byId.get(id);
}

export function findCatalogEntry(scope: string, category: string, fuelCategory: string, fuelType: string): CatalogEntry | undefined {
  return byTuple.get(tupleKey(scope, category, fuelCategory, fuelType));
}

export interface LineInput {
  id: string;
  catalogId: string;
  quantity: number;
  unit: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  documentId?: string | null;
  evidence?: string | null;
  confidence?: number | null;
  edited?: boolean;
  description?: string | null;
}

/** Computes one inventory line. Throws UnitError for an unknown fuel or an incompatible unit. */
export function computeLine(input: LineInput): InventoryLine {
  const entry = getCatalogEntry(input.catalogId);
  if (!entry) throw new UnitError(`Unknown emission source "${input.catalogId}"`);
  if (!Number.isFinite(input.quantity) || input.quantity < 0) throw new UnitError('Quantity must be a non-negative number');
  const nativeQuantity = convertToNative(input.quantity, input.unit, entry.nativeUnit, entry.conversion);
  return {
    id: input.id,
    scope: entry.scope,
    category: entry.category,
    fuelCategory: entry.fuelCategory,
    fuelType: entry.fuelType,
    quantity: input.quantity,
    unit: input.unit,
    nativeQuantity: round(nativeQuantity, 6),
    nativeUnit: entry.nativeUnit,
    factor: entry.factor,
    emissions: round(nativeQuantity * entry.factor, 4),
    periodStart: input.periodStart ?? null,
    periodEnd: input.periodEnd ?? null,
    documentId: input.documentId ?? null,
    evidence: input.evidence ?? null,
    confidence: input.confidence ?? null,
    edited: input.edited ?? false,
    description: input.description ?? null,
  };
}

export interface InventoryTotals {
  /** kg CO2e */
  total: number;
  /** kg CO2e by "Scope 1 - Stationary" style keys */
  breakdown: Record<string, number>;
}

export function totals(lines: InventoryLine[]): InventoryTotals {
  const breakdown: Record<string, number> = {};
  let total = 0;
  for (const line of lines) {
    const key = `${line.scope} - ${line.category}`;
    breakdown[key] = round((breakdown[key] ?? 0) + line.emissions, 4);
    total += line.emissions;
  }
  return { total: round(total, 4), breakdown };
}

/** The catalog id behind a stored line. Lines keep their source names, not the id. */
export function catalogKey(line: Pick<InventoryLine, 'scope' | 'category' | 'fuelCategory' | 'fuelType'>): string {
  return findCatalogEntry(line.scope, line.category, line.fuelCategory, line.fuelType)?.id ?? slug(line.scope, line.category, line.fuelCategory, line.fuelType);
}

/** The source of a stored line's factor, when the line still uses that catalog entry's factor. */
export function lineFactorSource(line: Pick<InventoryLine, 'scope' | 'category' | 'fuelCategory' | 'fuelType' | 'factor'>): FactorSource | null {
  const entry = findCatalogEntry(line.scope, line.category, line.fuelCategory, line.fuelType);
  return entry && entry.factor === line.factor ? entry.source : null;
}

function round(value: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}
