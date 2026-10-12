import { describe, expect, it } from 'vitest';
import { catalog, computeLine, type LineInput } from '@/lib/emissions/catalog';
import { grade, runRules } from '../rules';

const grid = catalog.find((e) => e.scope === 'Scope 2' && e.fuelType === 'Grid Average')!.id;
const diesel = catalog.find((e) => e.category === 'Mobile' && e.fuelType === 'Diesel (100% mineral diesel)')!.id;
const r134a = catalog.find((e) => e.fuelType === 'HFC-134a')!.id;

const line = (input: Partial<LineInput> & Pick<LineInput, 'id' | 'catalogId' | 'quantity' | 'unit'>) => computeLine(input);
const checksFailed = (result: ReturnType<typeof runRules>) => result.checks.filter((c) => !c.passed).map((c) => c.check);

describe('runRules', () => {
  it('passes a clean inventory', () => {
    const result = runRules({
      source: 'calculator',
      documents: [],
      lines: [
        line({ id: '1', catalogId: grid, quantity: 12000, unit: 'kWh', periodStart: '2026-01-01', periodEnd: '2026-01-31' }),
        line({ id: '2', catalogId: grid, quantity: 11000, unit: 'kWh', periodStart: '2026-02-01', periodEnd: '2026-02-28' }),
        line({ id: '3', catalogId: diesel, quantity: 800, unit: 'litres' }),
      ],
    });
    expect(result.findings).toEqual([]);
    expect(grade(result.findings)).toEqual({ score: 0, level: 'low' });
  });

  it('flags the same bill uploaded twice as high risk', () => {
    const result = runRules({
      source: 'ai_extraction',
      documents: [
        { id: 'd1', fileName: 'jan.pdf', fingerprint: 'utility|123|inv-9|2026-01' },
        { id: 'd2', fileName: 'jan (copy).pdf', fingerprint: 'utility|123|inv-9|2026-01' },
      ],
      lines: [
        line({ id: '1', catalogId: grid, quantity: 12000, unit: 'kWh', documentId: 'd1', confidence: 0.95 }),
        line({ id: '2', catalogId: grid, quantity: 12000, unit: 'kWh', documentId: 'd2', confidence: 0.95 }),
      ],
    });
    expect(checksFailed(result)).toEqual(expect.arrayContaining(['duplicate-document', 'duplicate-line']));
    expect(grade(result.findings).level).toBe('high');
  });

  it('flags a bill already counted in another certificate', () => {
    const result = runRules({
      source: 'ai_extraction',
      documents: [{ id: 'd1', fileName: 'jan.pdf', fingerprint: 'f', reusedIn: [{ emissionDataId: 'x', certificateId: 'GT-2026-AAAAAA' }] }],
      lines: [line({ id: '1', catalogId: grid, quantity: 100, unit: 'kWh', documentId: 'd1' })],
    });
    expect(result.findings[0]).toMatchObject({ check: 'duplicate-document', severity: 'high' });
  });

  it('flags overlapping periods, outliers, unreviewed low confidence and missing scope 2', () => {
    const result = runRules({
      source: 'ai_extraction',
      documents: [],
      lines: [
        line({ id: '1', catalogId: diesel, quantity: 500, unit: 'litres', periodStart: '2026-01-01', periodEnd: '2026-02-15', documentId: 'a', confidence: 0.5 }),
        line({ id: '2', catalogId: diesel, quantity: 450, unit: 'litres', periodStart: '2026-02-01', periodEnd: '2026-03-01', documentId: 'b', confidence: 0.9 }),
        line({ id: '3', catalogId: diesel, quantity: 520, unit: 'litres', documentId: 'c', confidence: 0.9 }),
        line({ id: '4', catalogId: diesel, quantity: 480000, unit: 'litres', documentId: 'd', confidence: 0.9 }),
      ],
    });
    expect(checksFailed(result)).toEqual(
      expect.arrayContaining(['period-overlap', 'magnitude-outlier', 'low-confidence', 'scope-coverage']),
    );
  });

  it('flags implausible refrigerant losses and zero lines', () => {
    const result = runRules({
      source: 'calculator',
      documents: [],
      lines: [line({ id: '1', catalogId: r134a, quantity: 2, unit: 'tonnes' }), line({ id: '2', catalogId: grid, quantity: 0, unit: 'kWh' })],
    });
    expect(checksFailed(result)).toEqual(expect.arrayContaining(['refrigerant-magnitude', 'zero-quantity']));
  });
});

describe('grade', () => {
  it('maps findings to a bounded score and level', () => {
    const f = (severity: 'low' | 'medium' | 'high') => ({ id: 'x', check: 'x', severity, title: '', detail: '', lineIds: [], recommendation: '' });
    expect(grade([f('low')])).toEqual({ score: 5, level: 'low' });
    expect(grade([f('medium'), f('medium')])).toEqual({ score: 30, level: 'medium' });
    expect(grade([f('high')]).level).toBe('high');
    expect(grade(Array(10).fill(f('high'))).score).toBe(100);
  });
});
