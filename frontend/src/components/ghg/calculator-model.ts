import { getEquipmentOptionsWithCustom } from '@/data/equipmentTypes';
import { catalog, computeLine, findCatalogEntry, type CatalogEntry } from '@/lib/emissions/catalog';
import { compatibleUnits, convertToNative, UnitError } from '@/lib/emissions/units';
import type {
  CalculationState,
  CustomEquipmentTypes,
  CustomFuelDefinition,
  EmissionEntry,
  EmissionFactorsDatabase,
} from '@/types/ghg';

// Calculator logic on top of the emission factor catalog, so the calculator and the server compute
// every catalog fuel the same way (computeLine). Custom fuels are kept apart: they are estimates.

export type Scope = 'Scope 1' | 'Scope 2';
export const SCOPES: Scope[] = ['Scope 1', 'Scope 2'];

const unique = (values: string[]) => [...new Set(values)];

export function asScope(scope: string): Scope {
  return scope === 'Scope 2' ? 'Scope 2' : 'Scope 1';
}

export function categoriesFor(scope: Scope): string[] {
  return unique(catalog.filter((e) => e.scope === scope).map((e) => e.category));
}

export function fuelCategoriesFor(scope: Scope, category: string): string[] {
  return unique(catalog.filter((e) => e.scope === scope && e.category === category).map((e) => e.fuelCategory));
}

export interface FuelOption {
  name: string;
  custom: boolean;
}

export function fuelOptionsFor(scope: Scope, category: string, fuelCategory: string, customFuels: CustomFuelDefinition[]): FuelOption[] {
  const builtIn = catalog
    .filter((e) => e.scope === scope && e.category === category && e.fuelCategory === fuelCategory)
    .map((e) => ({ name: e.fuelType, custom: false }));
  const custom = customFuels
    .filter((f) => f.scope === scope && f.category === category && f.fuelCategory === fuelCategory)
    .map((f) => ({ name: f.name, custom: true }));
  return [...builtIn, ...custom];
}

export type FactorSource =
  | { kind: 'catalog'; entry: CatalogEntry; units: string[]; defaultUnit: string; factor: number; factorUnit: string }
  | { kind: 'custom'; fuel: CustomFuelDefinition; units: string[]; defaultUnit: string; factor: number; factorUnit: string };

/** The factor behind a selection: a catalog entry, or a custom fuel. */
export function resolveSource(
  sel: Pick<CalculationState, 'scope' | 'category' | 'fuelCategory' | 'fuelType'>,
  customFuels: CustomFuelDefinition[],
): FactorSource | null {
  const scope = asScope(sel.scope);
  const entry = findCatalogEntry(scope, sel.category, sel.fuelCategory, sel.fuelType);
  if (entry) return { kind: 'catalog', entry, units: entry.units, defaultUnit: entry.nativeUnit, factor: entry.factor, factorUnit: entry.nativeUnit };
  const fuel = customFuels.find(
    (f) => f.scope === scope && f.category === sel.category && f.fuelCategory === sel.fuelCategory && f.name === sel.fuelType,
  );
  if (fuel) return { kind: 'custom', fuel, units: compatibleUnits(fuel.unit), defaultUnit: fuel.unit, factor: fuel.factor, factorUnit: fuel.unit };
  return null;
}

/** The unit a group's factors are expressed in, used as the default for custom fuels in that group. */
export function groupUnit(scope: Scope, category: string, fuelCategory: string): string {
  return catalog.find((e) => e.scope === scope && e.category === category && e.fuelCategory === fuelCategory)?.nativeUnit ?? 'kg';
}

/** Makes every dependent field of a selection valid after one of them changed. */
export function normalizeSelection(
  calc: CalculationState,
  customFuels: CustomFuelDefinition[],
  customEquipment: CustomEquipmentTypes,
): CalculationState {
  const scope = asScope(calc.scope);
  const categories = categoriesFor(scope);
  const category = categories.includes(calc.category) ? calc.category : categories[0];
  const fuelCategories = fuelCategoriesFor(scope, category);
  const fuelCategory = fuelCategories.includes(calc.fuelCategory) ? calc.fuelCategory : fuelCategories[0];
  const fuels = fuelOptionsFor(scope, category, fuelCategory, customFuels);
  const fuelType = fuels.some((f) => f.name === calc.fuelType) ? calc.fuelType : (fuels[0]?.name ?? '');
  const equipment = scope === 'Scope 1' ? getEquipmentOptionsWithCustom(category, customEquipment) : [];
  const equipmentType = scope === 'Scope 1' ? (equipment.includes(calc.equipmentType) ? calc.equipmentType : (equipment[0] ?? '')) : '';
  const source = resolveSource({ scope, category, fuelCategory, fuelType }, customFuels);
  const unit = source && source.units.includes(calc.unit) ? calc.unit : (source?.defaultUnit ?? '');
  return { ...calc, scope, category, fuelCategory, fuelType, equipmentType, unit };
}

export type EntryResult = { ok: true; entry: EmissionEntry } | { ok: false; error: string };

/** Computes one calculator entry. Catalog fuels go through computeLine, exactly as on the server. */
export function computeEntry(
  input: Pick<EmissionEntry, 'id' | 'scope' | 'category' | 'fuelCategory' | 'fuelType' | 'amount' | 'unit_type' | 'timestamp' | 'equipmentType'>,
  customFuels: CustomFuelDefinition[],
): EntryResult {
  const source = resolveSource(input, customFuels);
  if (!source) return { ok: false, error: `${input.fuelType || 'This fuel'} has no emission factor.` };
  try {
    if (source.kind === 'catalog') {
      const line = computeLine({ id: input.id, catalogId: source.entry.id, quantity: input.amount, unit: input.unit_type });
      return {
        ok: true,
        entry: {
          ...input,
          baseFactor: line.factor,
          convertedFactor: input.amount > 0 ? line.emissions / input.amount : 0,
          emissions: line.emissions,
          catalogId: source.entry.id,
          nativeQuantity: line.nativeQuantity,
          nativeUnit: line.nativeUnit,
          custom: false,
          issue: null,
        },
      };
    }
    const native = convertToNative(input.amount, input.unit_type, source.fuel.unit);
    const emissions = Math.round(native * source.fuel.factor * 10000) / 10000;
    return {
      ok: true,
      entry: {
        ...input,
        baseFactor: source.fuel.factor,
        convertedFactor: input.amount > 0 ? emissions / input.amount : 0,
        emissions,
        catalogId: null,
        nativeQuantity: native,
        nativeUnit: source.fuel.unit,
        custom: true,
        issue: null,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof UnitError ? error.message : 'Could not compute this entry.' };
  }
}

const LEGACY_UNITS: Record<string, string> = { liters: 'litres', tons: 'tonnes', gallons: 'US gallons' };

/**
 * Re-computes an entry saved by an earlier version of the calculator, which multiplied by a generic
 * unit table and got fuels with per-tonne or per-m³ factors wrong. Entries that can no longer be
 * computed are kept with an issue so the person can re-enter them.
 */
export function migrateEntry(saved: EmissionEntry, customFuels: CustomFuelDefinition[]): EmissionEntry {
  const scope = asScope(saved.scope);
  const category = scope === 'Scope 2' && !saved.category ? saved.fuelCategory : saved.category;
  const unit = LEGACY_UNITS[saved.unit_type] ?? saved.unit_type;
  const input = { ...saved, scope, category, unit_type: unit };
  const result = computeEntry(input, customFuels);
  if (result.ok) return result.entry;
  return {
    ...input,
    emissions: 0,
    convertedFactor: 0,
    custom: !findCatalogEntry(scope, category, saved.fuelCategory, saved.fuelType),
    issue: `${result.error.replace(/\.?$/, '.')} Delete this entry and add it again.`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Pulls custom fuels out of the nested factor database the previous calculator version saved. */
export function legacyCustomFuels(saved: unknown): CustomFuelDefinition[] {
  if (!isRecord(saved)) return [];
  const fuels: CustomFuelDefinition[] = [];
  const add = (scope: Scope, category: string, fuelCategory: string, group: unknown) => {
    if (!isRecord(group)) return;
    for (const [name, value] of Object.entries(group)) {
      if (!isRecord(value) || value.custom !== true || typeof value.factor !== 'number') continue;
      if (findCatalogEntry(scope, category, fuelCategory, name)) continue;
      fuels.push({
        id: `${scope}|${category}|${fuelCategory}|${name}`,
        scope,
        category,
        fuelCategory,
        name,
        factor: value.factor,
        unit: groupUnit(scope, category, fuelCategory),
        timestamp: typeof value.timestamp === 'string' ? value.timestamp : new Date().toISOString(),
      });
    }
  };
  const scope1 = saved['Scope 1'];
  if (isRecord(scope1)) {
    for (const [category, fuelCategories] of Object.entries(scope1)) {
      if (!isRecord(fuelCategories)) continue;
      for (const [fuelCategory, group] of Object.entries(fuelCategories)) add('Scope 1', category, fuelCategory, group);
    }
  }
  const scope2 = saved['Scope 2'];
  if (isRecord(scope2)) {
    for (const [fuelCategory, group] of Object.entries(scope2)) add('Scope 2', fuelCategory, fuelCategory, group);
  }
  return fuels;
}

/** Custom fuels in the nested shape the spreadsheet export reads ("Custom Fuels" sheet). */
export function exportFactors(customFuels: CustomFuelDefinition[]): EmissionFactorsDatabase {
  const db: EmissionFactorsDatabase = { 'Scope 1': {}, 'Scope 2': {} };
  for (const fuel of customFuels) {
    const value = { factor: fuel.factor, custom: true, timestamp: fuel.timestamp };
    const name = `${fuel.name} (per ${fuel.unit})`;
    if (fuel.scope === 'Scope 1') {
      const category = (db['Scope 1'][fuel.category] ??= {});
      (category[fuel.fuelCategory] ??= {})[name] = value;
    } else {
      (db['Scope 2'][fuel.fuelCategory] ??= {})[name] = value;
    }
  }
  return db;
}

/** True when an entry can go into a certifiable inventory. */
export function isCertifiable(entry: EmissionEntry): entry is EmissionEntry & { catalogId: string } {
  return Boolean(entry.catalogId) && !entry.custom && !entry.issue;
}
