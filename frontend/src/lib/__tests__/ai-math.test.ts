import { describe, expect, it } from 'vitest';
import { fitAllocation, gradeFor, overallScore, quantifyMeasures, trajectory, type ProposedMeasure } from '../ai-math';

const measure = (overrides: Partial<ProposedMeasure>): ProposedMeasure => ({
  id: 'm',
  title: 't',
  description: 'd',
  targetCategory: 'Scope 2 - Electricity',
  scope: 'Scope 2',
  reductionShare: 0.5,
  capex: 'low',
  paybackYears: 2,
  difficulty: 'easy',
  startYear: 2027,
  rationale: 'r',
  ...overrides,
});

describe('quantifyMeasures', () => {
  const breakdown = { 'Scope 2 - Electricity': 10_000, 'Scope 1 - Mobile': 4_000 };

  it('computes tonnes from the inventory, not from the model', () => {
    const [m] = quantifyMeasures(breakdown, [measure({ reductionShare: 0.3 })]);
    expect(m.annualReductionTonnes).toBe(3);
  });

  it('never removes more than 95% of a category across measures', () => {
    const result = quantifyMeasures(breakdown, [measure({ id: 'a', reductionShare: 0.8 }), measure({ id: 'b', reductionShare: 0.8 })]);
    const removed = result.reduce((sum, m) => sum + m.annualReductionTonnes, 0);
    expect(removed).toBeCloseTo(9.5, 6);
  });

  it('drops measures that target a category the inventory does not have', () => {
    expect(quantifyMeasures(breakdown, [measure({ targetCategory: 'Scope 1 - Fugitive' })])).toEqual([]);
  });
});

describe('trajectory', () => {
  it('applies each measure from its start year', () => {
    const measures = quantifyMeasures({ 'Scope 2 - Electricity': 10_000 }, [measure({ reductionShare: 0.4, startYear: 2028 })]);
    expect(trajectory(10, measures, 2026, 2029).map((p) => p.projectedTonnes)).toEqual([10, 10, 6, 6]);
  });
});

describe('credit grading', () => {
  it('weights dimensions and maps to a grade', () => {
    expect(overallScore({ additionality: 100, permanence: 100, mrv: 100, leakage: 100, coBenefits: 100 })).toBe(100);
    expect(overallScore({ additionality: 50, permanence: 50, mrv: 50, leakage: 50, coBenefits: 50 })).toBe(50);
    expect(gradeFor(90)).toBe('AAA');
    expect(gradeFor(70)).toBe('A');
    expect(gradeFor(10)).toBe('C');
  });
});

describe('fitAllocation', () => {
  const listings = [
    { id: 'a', available: 5, priceHbar: 2 },
    { id: 'b', available: 100, priceHbar: 1 },
  ];

  it('respects stock, need and unknown listings', () => {
    const result = fitAllocation([{ creditId: 'a', quantity: 9 }, { creditId: 'zzz', quantity: 3 }, { creditId: 'b', quantity: 10 }], listings, 8, null);
    expect(result.basket).toEqual([{ creditId: 'a', quantity: 5 }, { creditId: 'b', quantity: 3 }]);
    expect(result.totalTonnes).toBe(8);
    expect(result.coverage).toBe(1);
  });

  it('trims to the budget', () => {
    const result = fitAllocation([{ creditId: 'a', quantity: 5 }, { creditId: 'b', quantity: 5 }], listings, 10, 11);
    expect(result.totalCostHbar).toBeLessThanOrEqual(11);
    expect(result.basket).toEqual([{ creditId: 'a', quantity: 5 }, { creditId: 'b', quantity: 1 }]);
  });
});
