import { describe, expect, it } from 'vitest';
import { catalog, computeLine, getCatalogEntry, totals } from '../catalog';
import { UnitError } from '../units';

const id = (scope: string, fuelType: string) => catalog.find((e) => e.scope === scope && e.fuelType === fuelType)!.id;

describe('catalog', () => {
  it('flattens the factor database with unique ids', () => {
    expect(catalog.length).toBeGreaterThan(100);
    expect(new Set(catalog.map((e) => e.id)).size).toBe(catalog.length);
  });

  it('assigns native units by fuel type', () => {
    expect(getCatalogEntry(id('Scope 2', 'Grid Average'))?.nativeUnit).toBe('kWh');
    expect(catalog.find((e) => e.fuelType === 'Coal (Industrial)')?.nativeUnit).toBe('tonnes');
    expect(catalog.find((e) => e.fuelType === 'Diesel (100% mineral diesel)' && e.category === 'Stationary')?.nativeUnit).toBe('litres');
    expect(catalog.find((e) => e.fuelType === 'Natural Gas' && e.category === 'Stationary')?.nativeUnit).toBe('m³');
    expect(catalog.find((e) => e.fuelType === 'HFC-134a')?.nativeUnit).toBe('kg');
  });
});

describe('computeLine', () => {
  it('computes emissions from the native quantity', () => {
    const line = computeLine({ id: 'a', catalogId: id('Scope 2', 'Grid Average'), quantity: 2, unit: 'MWh' });
    expect(line.nativeQuantity).toBe(2000);
    expect(line.emissions).toBeCloseTo(770, 6);
  });

  it('handles coal entered in kg against a per-tonne factor', () => {
    const coal = catalog.find((e) => e.fuelType === 'Coal (Industrial)')!;
    const line = computeLine({ id: 'c', catalogId: coal.id, quantity: 500, unit: 'kg' });
    expect(line.emissions).toBeCloseTo(0.5 * coal.factor, 4);
  });

  it('rejects incompatible units and unknown sources', () => {
    expect(() => computeLine({ id: 'x', catalogId: id('Scope 2', 'Grid Average'), quantity: 1, unit: 'litres' })).toThrow(UnitError);
    expect(() => computeLine({ id: 'x', catalogId: 'nope', quantity: 1, unit: 'kWh' })).toThrow(UnitError);
    expect(() => computeLine({ id: 'x', catalogId: id('Scope 2', 'Grid Average'), quantity: -1, unit: 'kWh' })).toThrow(UnitError);
  });
});

describe('totals', () => {
  it('sums by scope and category', () => {
    const grid = id('Scope 2', 'Grid Average');
    const lines = [
      computeLine({ id: '1', catalogId: grid, quantity: 1000, unit: 'kWh' }),
      computeLine({ id: '2', catalogId: grid, quantity: 1000, unit: 'kWh' }),
    ];
    expect(totals(lines)).toEqual({ total: 770, breakdown: { 'Scope 2 - Electricity': 770 } });
  });
});
