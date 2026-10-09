import { describe, expect, it } from 'vitest';
import { compatibleUnits, convertToNative, NATURAL_GAS_KWH_PER_M3, UnitError } from '../units';

describe('convertToNative', () => {
  it('converts within a dimension', () => {
    expect(convertToNative(1, 'tonnes', 'kg')).toBe(1000);
    expect(convertToNative(2500, 'kg', 'tonnes')).toBe(2.5);
    expect(convertToNative(1, 'm³', 'litres')).toBe(1000);
    expect(convertToNative(10, 'US gallons', 'litres')).toBeCloseTo(37.8541, 4);
    expect(convertToNative(1, 'MWh', 'kWh')).toBe(1000);
    expect(convertToNative(1, 'therms', 'kWh')).toBeCloseTo(29.3071, 4);
  });

  it('rejects a unit of the wrong dimension instead of guessing', () => {
    expect(() => convertToNative(100, 'kg', 'litres')).toThrow(UnitError);
    expect(() => convertToNative(100, 'kWh', 'litres')).toThrow(UnitError);
  });

  it('converts energy to volume only with a calorific value', () => {
    const m3 = convertToNative(NATURAL_GAS_KWH_PER_M3 * 10, 'kWh', 'm³', { kwhPerCubicMetre: NATURAL_GAS_KWH_PER_M3 });
    expect(m3).toBeCloseTo(10, 6);
  });

  it('rejects unknown units', () => {
    expect(() => convertToNative(1, 'barrels', 'litres')).toThrow(/Unknown unit/);
  });
});

describe('compatibleUnits', () => {
  it('lists energy units for natural gas only when a calorific value is given', () => {
    expect(compatibleUnits('m³')).not.toContain('kWh');
    expect(compatibleUnits('m³', { kwhPerCubicMetre: NATURAL_GAS_KWH_PER_M3 })).toContain('kWh');
  });
});
