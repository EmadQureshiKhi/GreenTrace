// Unit handling for activity data. Every emission factor is expressed per one "native" unit
// (litres of diesel, m³ of natural gas, tonnes of coal, kg of refrigerant, kWh of electricity).
// Quantities in any other unit are converted to the native unit before multiplying, and a quantity
// whose unit has a different dimension (kg of diesel against a per-litre factor) is rejected instead
// of silently producing a wrong number.

export type Dimension = 'volume' | 'mass' | 'energy';

interface UnitDef {
  dimension: Dimension;
  /** Size of one unit in the dimension's base unit (litre, kg, kWh). */
  toBase: number;
  label: string;
}

export const UNITS: Record<string, UnitDef> = {
  litres: { dimension: 'volume', toBase: 1, label: 'litres' },
  kL: { dimension: 'volume', toBase: 1000, label: 'kilolitres' },
  'm³': { dimension: 'volume', toBase: 1000, label: 'cubic metres' },
  'US gallons': { dimension: 'volume', toBase: 3.78541, label: 'US gallons' },
  'imperial gallons': { dimension: 'volume', toBase: 4.54609, label: 'imperial gallons' },
  'cubic feet': { dimension: 'volume', toBase: 28.3168, label: 'cubic feet' },
  ccf: { dimension: 'volume', toBase: 2831.68, label: 'hundred cubic feet' },

  kg: { dimension: 'mass', toBase: 1, label: 'kilograms' },
  tonnes: { dimension: 'mass', toBase: 1000, label: 'metric tonnes' },
  lb: { dimension: 'mass', toBase: 0.453592, label: 'pounds' },
  'short tons': { dimension: 'mass', toBase: 907.185, label: 'US short tons' },

  kWh: { dimension: 'energy', toBase: 1, label: 'kilowatt hours' },
  MWh: { dimension: 'energy', toBase: 1000, label: 'megawatt hours' },
  GJ: { dimension: 'energy', toBase: 277.778, label: 'gigajoules' },
  MJ: { dimension: 'energy', toBase: 0.277778, label: 'megajoules' },
  therms: { dimension: 'energy', toBase: 29.3071, label: 'therms' },
  mmBtu: { dimension: 'energy', toBase: 293.071, label: 'million BTU' },
};

export const UNIT_NAMES = Object.keys(UNITS);

/**
 * Natural gas is billed by volume or by energy. DEFRA's 2023 factors give 2.02266 kg CO2e/m³ and
 * 0.18293 kg CO2e/kWh (gross CV), i.e. about 11.057 kWh per m³. Used only for natural gas lines.
 */
export const NATURAL_GAS_KWH_PER_M3 = 11.057;

export class UnitError extends Error {}

export interface ConversionOptions {
  /** Allows energy <-> volume conversion at this calorific value (kWh per m³). */
  kwhPerCubicMetre?: number;
}

/** Converts `quantity` from `unit` to `nativeUnit`. Throws UnitError if the dimensions don't match. */
export function convertToNative(quantity: number, unit: string, nativeUnit: string, options: ConversionOptions = {}): number {
  const from = UNITS[unit];
  const to = UNITS[nativeUnit];
  if (!from) throw new UnitError(`Unknown unit "${unit}"`);
  if (!to) throw new UnitError(`Unknown unit "${nativeUnit}"`);
  if (from.dimension === to.dimension) return (quantity * from.toBase) / to.toBase;

  const cv = options.kwhPerCubicMetre;
  if (cv && from.dimension === 'energy' && to.dimension === 'volume') {
    const kwh = quantity * from.toBase;
    const litres = (kwh / cv) * 1000;
    return litres / to.toBase;
  }
  if (cv && from.dimension === 'volume' && to.dimension === 'energy') {
    const cubicMetres = (quantity * from.toBase) / 1000;
    return (cubicMetres * cv) / to.toBase;
  }
  throw new UnitError(`Cannot convert ${UNITS[unit].label} to ${UNITS[nativeUnit].label}`);
}

/** Units a quantity may be entered in for a factor with the given native unit. */
export function compatibleUnits(nativeUnit: string, options: ConversionOptions = {}): string[] {
  const native = UNITS[nativeUnit];
  if (!native) return [];
  return UNIT_NAMES.filter((name) => {
    const def = UNITS[name];
    if (def.dimension === native.dimension) return true;
    return Boolean(options.kwhPerCubicMetre) && new Set([def.dimension, native.dimension]).size === 2 &&
      [def.dimension, native.dimension].every((d) => d === 'energy' || d === 'volume');
  });
}
