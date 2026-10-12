import { gradeFor } from '@/lib/ai-math';
import type { CreditGrade, CreditRating } from '@/lib/types';
import { cn } from '@/lib/utils';

export type GradeTone = 'good' | 'fair' | 'poor';

export function gradeTone(grade: CreditGrade): GradeTone {
  if (grade === 'AAA' || grade === 'AA' || grade === 'A') return 'good';
  if (grade === 'BBB' || grade === 'BB') return 'fair';
  return 'poor';
}

const BADGE_CLASSES: Record<GradeTone, string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  fair: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200',
  poor: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
};

const SOLID_CLASSES: Record<GradeTone, string> = {
  good: 'bg-emerald-600 text-white',
  fair: 'bg-amber-500 text-white',
  poor: 'bg-red-600 text-white',
};

const BAR_CLASSES: Record<GradeTone, string> = {
  good: 'bg-emerald-500',
  fair: 'bg-amber-500',
  poor: 'bg-red-500',
};

export function gradeSolidClass(grade: CreditGrade): string {
  return SOLID_CLASSES[gradeTone(grade)];
}

/** Bar colour for a 0-100 score, on the same scale as the grades. */
export function scoreBarClass(score: number): string {
  return BAR_CLASSES[gradeTone(gradeFor(score))];
}

/** Grade and overall score, coloured by grade band. */
export function RatingBadge({ rating, className }: { rating: Pick<CreditRating, 'grade' | 'overall_score'>; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs',
        BADGE_CLASSES[gradeTone(rating.grade)],
        className,
      )}
    >
      <span className="font-bold tracking-wide">{rating.grade}</span>
      <span className="font-medium opacity-80">{rating.overall_score}/100</span>
    </span>
  );
}

/** A 0-100 score as a thin horizontal bar. */
export function ScoreBar({ score, className }: { score: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, score));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div className={cn('h-full rounded-full transition-all', scoreBarClass(clamped))} style={{ width: `${clamped}%` }} />
    </div>
  );
}
