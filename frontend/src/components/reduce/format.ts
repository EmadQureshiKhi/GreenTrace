import type { EmissionData } from '@/lib/types';
import { formatDate } from '@/lib/format';

/** Tonnes with sensible precision: more decimals for small values. */
export function formatT(tonnes: number): string {
  const abs = Math.abs(tonnes);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return tonnes.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export function inventoryLabel(inventory: EmissionData): string {
  return inventory.organization || inventory.file_name || 'Untitled inventory';
}

export function inventoryPeriod(inventory: EmissionData): string | null {
  const { reporting_period_start: start, reporting_period_end: end } = inventory;
  if (!start && !end) return null;
  const fmt = (d: string) => formatDate(d);
  if (start && end) return `${fmt(start)} - ${fmt(end)}`;
  return fmt((start ?? end)!);
}

export const BUDGETS = [
  { value: 'low', label: 'Low', description: 'Operational changes and procurement, little capital spend' },
  { value: 'medium', label: 'Medium', description: 'Targeted upgrades with a few years of payback' },
  { value: 'high', label: 'High', description: 'Capital projects such as electrification and on-site generation' },
] as const;

export type Budget = (typeof BUDGETS)[number]['value'];
