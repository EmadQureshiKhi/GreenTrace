import { describe, expect, it } from 'vitest';
import { gridFactors } from '@/data/gridFactors';
import { catalog, catalogKey, computeLine, findCatalogEntry, GENERIC_GRID_ID, getCatalogEntry, gridEntryId, lineFactorSource } from '../catalog';

// Location-based national grid factors, as read in each publisher's document (kg per kWh).
const EXPECTED: Record<string, { factor: number; gas: 'CO2' | 'CO2e' }> = {
  GB: { factor: 0.13096, gas: 'CO2e' },
  US: { factor: 0.34967, gas: 'CO2e' },
  DE: { factor: 0.344, gas: 'CO2' },
  FR: { factor: 0.0196, gas: 'CO2e' },
  TR: { factor: 0.469, gas: 'CO2e' },
  IN: { factor: 0.675, gas: 'CO2' },
  CN: { factor: 0.5306, gas: 'CO2' },
  JP: { factor: 0.423, gas: 'CO2' },
  AU: { factor: 0.62, gas: 'CO2e' },
  CA: { factor: 0.11, gas: 'CO2e' },
  BR: { factor: 0.0461, gas: 'CO2' },
  ZA: { factor: 0.96, gas: 'CO2e' },
  SG: { factor: 0.402, gas: 'CO2' },
  EU: { factor: 0.18344, gas: 'CO2e' },
};

const gridEntries = catalog.filter((e) => e.country);

describe('national grid factors', () => {
  it('has exactly the verified countries, with stable ids', () => {
    expect(gridEntries.map((e) => e.id).sort()).toEqual(
      [
        'scope-2-electricity-grid-au',
        'scope-2-electricity-grid-br',
        'scope-2-electricity-grid-ca',
        'scope-2-electricity-grid-cn',
        'scope-2-electricity-grid-de',
        'scope-2-electricity-grid-eu',
        'scope-2-electricity-grid-fr',
        'scope-2-electricity-grid-gb',
        'scope-2-electricity-grid-in',
        'scope-2-electricity-grid-jp',
        'scope-2-electricity-grid-sg',
        'scope-2-electricity-grid-tr',
        'scope-2-electricity-grid-us',
        'scope-2-electricity-grid-za',
      ].sort(),
    );
    expect(gridEntryId('GB')).toBe('scope-2-electricity-grid-gb');
  });

  it('uses the published factor and gas basis for every country', () => {
    for (const [code, want] of Object.entries(EXPECTED)) {
      const entry = getCatalogEntry(gridEntryId(code));
      expect(entry, code).toBeDefined();
      expect(entry!.factor, code).toBe(want.factor);
      expect(entry!.source!.gas, code).toBe(want.gas);
    }
    expect(gridFactors).toHaveLength(Object.keys(EXPECTED).length);
  });

  it('files every entry as Scope 2 grid electricity in kWh', () => {
    for (const entry of gridEntries) {
      expect(entry.scope).toBe('Scope 2');
      expect(entry.category).toBe('Electricity');
      expect(entry.fuelCategory).toBe('Electricity');
      expect(entry.fuelType).toBe(`Grid - ${entry.country!.name}`);
      expect(entry.nativeUnit).toBe('kWh');
      expect(entry.units).toEqual(expect.arrayContaining(['kWh', 'MWh']));
    }
  });

  it('cites an official document with a year for every entry', () => {
    for (const entry of gridEntries) {
      const source = entry.source!;
      expect(source.url, entry.id).toMatch(/^https:\/\/[^\s]+$/);
      expect(source.dataYear, entry.id).toMatch(/(19|20)\d{2}/);
      expect(source.publisher.length, entry.id).toBeGreaterThan(2);
      expect(source.title.length, entry.id).toBeGreaterThan(5);
      expect(source.citation.length, entry.id).toBeGreaterThan(2);
      expect(source.boundary.length, entry.id).toBeGreaterThan(2);
    }
  });

  it('keeps the generic grid average and its id unchanged', () => {
    const generic = getCatalogEntry(GENERIC_GRID_ID);
    expect(generic).toMatchObject({ fuelType: 'Grid Average', factor: 0.385, country: null, source: null });
  });

  it('converts kWh and MWh through a national entry', () => {
    const gb = gridEntryId('GB');
    expect(computeLine({ id: 'k', catalogId: gb, quantity: 18420, unit: 'kWh' }).emissions).toBeCloseTo(18420 * 0.13096, 4);
    const mwh = computeLine({ id: 'm', catalogId: gb, quantity: 18.42, unit: 'MWh' });
    expect(mwh.nativeQuantity).toBe(18420);
    expect(mwh.emissions).toBeCloseTo(2412.2832, 4);
    expect(computeLine({ id: 'u', catalogId: gridEntryId('US'), quantity: 2, unit: 'MWh' }).emissions).toBeCloseTo(699.34, 4);
  });

  it('round-trips a stored line back to its catalog id and source', () => {
    const line = computeLine({ id: 'r', catalogId: gridEntryId('FR'), quantity: 1000, unit: 'kWh' });
    expect(catalogKey(line)).toBe('scope-2-electricity-grid-fr');
    expect(findCatalogEntry(line.scope, line.category, line.fuelCategory, line.fuelType)?.id).toBe('scope-2-electricity-grid-fr');
    expect(lineFactorSource(line)?.citation).toBe('RTE 2025');
    // A line stored with a different factor than the catalog's no longer claims that source.
    expect(lineFactorSource({ ...line, factor: 0.05 })).toBeNull();
    // Older entries keep their slug ids.
    const generic = computeLine({ id: 'g', catalogId: GENERIC_GRID_ID, quantity: 1, unit: 'kWh' });
    expect(catalogKey(generic)).toBe(GENERIC_GRID_ID);
  });
});
