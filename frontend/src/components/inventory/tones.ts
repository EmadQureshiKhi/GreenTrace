import type { AiAudit, FindingSeverity } from '@/lib/types';

// Colour tokens for risk levels and finding severities, in light and dark mode.

export const RISK_TONES: Record<AiAudit['risk_level'], { badge: string; bar: string; label: string }> = {
  low: { badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200', bar: 'bg-emerald-500', label: 'Low risk' },
  medium: { badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200', bar: 'bg-amber-500', label: 'Medium risk' },
  high: { badge: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200', bar: 'bg-red-500', label: 'High risk' },
};

export const SEVERITY_TONES: Record<FindingSeverity, { badge: string; border: string; label: string }> = {
  high: { badge: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200', border: 'border-l-red-500', label: 'High' },
  medium: { badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200', border: 'border-l-amber-500', label: 'Medium' },
  low: { badge: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200', border: 'border-l-sky-500', label: 'Low' },
  info: { badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', border: 'border-l-slate-400', label: 'Info' },
};
