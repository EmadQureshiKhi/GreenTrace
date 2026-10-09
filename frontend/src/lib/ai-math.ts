import type { CreditGrade, ReductionMeasure } from '@/lib/types';

// Arithmetic behind the AI features. The model proposes; these functions decide the numbers.

// ---------------------------------------------------------------------------
// Reduction plans
// ---------------------------------------------------------------------------

export type ProposedMeasure = Omit<ReductionMeasure, 'annualReductionTonnes'>;

/**
 * Turns proposed measures into tonnes using the inventory's own breakdown.
 * Shares are clamped to [0, 0.95] and, where several measures target the same category, scaled so
 * together they never remove more than 95% of it (measures compound, they don't add past 100%).
 */
export function quantifyMeasures(breakdownKg: Record<string, number>, proposed: ProposedMeasure[]): ReductionMeasure[] {
  const valid = proposed.filter((m) => breakdownKg[m.targetCategory] > 0);
  const byCategory = new Map<string, number>();
  for (const m of valid) {
    const share = Math.min(0.95, Math.max(0, m.reductionShare));
    byCategory.set(m.targetCategory, (byCategory.get(m.targetCategory) ?? 0) + share);
  }
  return valid.map((m) => {
    const share = Math.min(0.95, Math.max(0, m.reductionShare));
    const categoryTotal = byCategory.get(m.targetCategory) ?? share;
    const scaled = categoryTotal > 0.95 ? (share * 0.95) / categoryTotal : share;
    return {
      ...m,
      reductionShare: round(scaled, 4),
      annualReductionTonnes: round((breakdownKg[m.targetCategory] / 1000) * scaled, 3),
    };
  });
}

export function trajectory(baselineTonnes: number, measures: ReductionMeasure[], fromYear: number, targetYear: number) {
  const points: { year: number; baselineTonnes: number; projectedTonnes: number }[] = [];
  for (let year = fromYear; year <= targetYear; year++) {
    const removed = measures.filter((m) => m.startYear <= year).reduce((sum, m) => sum + m.annualReductionTonnes, 0);
    points.push({ year, baselineTonnes: round(baselineTonnes, 3), projectedTonnes: round(Math.max(0, baselineTonnes - removed), 3) });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Credit ratings
// ---------------------------------------------------------------------------

export const RATING_WEIGHTS = {
  additionality: 0.3,
  permanence: 0.25,
  mrv: 0.2,
  leakage: 0.15,
  coBenefits: 0.1,
} as const;

export type RatingDimension = keyof typeof RATING_WEIGHTS;

export function overallScore(scores: Record<RatingDimension, number>): number {
  const total = (Object.keys(RATING_WEIGHTS) as RatingDimension[]).reduce(
    (sum, key) => sum + RATING_WEIGHTS[key] * Math.min(100, Math.max(0, scores[key])),
    0,
  );
  return Math.round(total);
}

export function gradeFor(score: number): CreditGrade {
  if (score >= 85) return 'AAA';
  if (score >= 75) return 'AA';
  if (score >= 65) return 'A';
  if (score >= 55) return 'BBB';
  if (score >= 45) return 'BB';
  if (score >= 35) return 'B';
  return 'C';
}

// ---------------------------------------------------------------------------
// Offset advisor
// ---------------------------------------------------------------------------

export interface Listing {
  id: string;
  available: number;
  priceHbar: number;
}

export interface Allocation {
  creditId: string;
  quantity: number;
}

/**
 * Makes a proposed basket feasible: known listings only, whole tonnes, within stock, merged per
 * listing, no more tonnes than needed, and trimmed (cheapest-last-in-the-list first) to the budget.
 */
export function fitAllocation(proposed: Allocation[], listings: Listing[], tonnesNeeded: number, budgetHbar: number | null) {
  const byId = new Map(listings.map((l) => [l.id, l]));
  const merged = new Map<string, number>();
  for (const a of proposed) {
    if (!byId.has(a.creditId)) continue;
    merged.set(a.creditId, (merged.get(a.creditId) ?? 0) + Math.max(0, Math.floor(a.quantity)));
  }

  const basket: Allocation[] = [];
  let tonnes = 0;
  for (const [creditId, quantity] of merged) {
    const listing = byId.get(creditId)!;
    const take = Math.min(quantity, listing.available, Math.max(0, tonnesNeeded - tonnes));
    if (take > 0) {
      basket.push({ creditId, quantity: take });
      tonnes += take;
    }
  }

  const cost = () => basket.reduce((sum, a) => sum + a.quantity * byId.get(a.creditId)!.priceHbar, 0);
  if (budgetHbar != null) {
    while (basket.length && cost() > budgetHbar + 1e-9) {
      const last = basket[basket.length - 1];
      last.quantity -= 1;
      if (last.quantity === 0) basket.pop();
    }
  }

  const totalTonnes = basket.reduce((sum, a) => sum + a.quantity, 0);
  return { basket, totalTonnes, totalCostHbar: round(cost(), 8), coverage: tonnesNeeded > 0 ? Math.min(1, totalTonnes / tonnesNeeded) : 1 };
}

function round(value: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}
