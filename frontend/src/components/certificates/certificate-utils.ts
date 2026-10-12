import { format, isValid, parseISO } from 'date-fns';
import type { Certificate, InventoryLine } from '@/lib/types';

// Pure helpers shared by the certificate list and the public certificate page.

/** Whole tonnes a certificate needs offset to be fully covered. Credits are whole tonnes, so round up. */
export function certifiedTonnes(certificate: Pick<Certificate, 'total_emissions'>): number {
  return Math.ceil(Number(certificate.total_emissions) / 1000);
}

/** Tonnes still to retire against the certificate. Mirrors the server's offset advisor. */
export function remainingTonnes(certificate: Pick<Certificate, 'total_emissions' | 'offset_tonnes'>): number {
  return Math.max(0, certifiedTonnes(certificate) - Number(certificate.offset_tonnes));
}

/** Offset progress in percent, 0-100. */
export function offsetPercent(certificate: Pick<Certificate, 'total_emissions' | 'offset_tonnes'>): number {
  const needed = certifiedTonnes(certificate);
  if (needed === 0) return 100;
  return Math.min(100, (Number(certificate.offset_tonnes) / needed) * 100);
}

export function formatDate(value: string | null | undefined, pattern = 'd MMM yyyy'): string {
  if (!value) return '';
  const date = parseISO(value);
  return isValid(date) ? format(date, pattern) : value;
}

export function formatPeriod(start: string | null | undefined, end: string | null | undefined): string {
  if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  if (end) return `Until ${formatDate(end)}`;
  return 'Not stated';
}

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

/** The activity lines of an inventory, skipping rows that predate the current line format. */
export function inventoryLines(data: unknown): InventoryLine[] {
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is InventoryLine => {
    if (!row || typeof row !== 'object') return false;
    const line = row as Record<string, unknown>;
    return typeof line.emissions === 'number' && typeof line.quantity === 'number' && typeof line.scope === 'string' && typeof line.category === 'string';
  });
}

/** Breakdown entries ("Scope 1 - Stationary combustion" -> kg), largest first. */
export function breakdownEntries(breakdown: Record<string, number> | null | undefined): { key: string; kg: number }[] {
  return Object.entries(breakdown ?? {})
    .map(([key, kg]) => ({ key, kg: Number(kg) }))
    .filter((entry) => Number.isFinite(entry.kg) && entry.kg > 0)
    .sort((a, b) => b.kg - a.kg);
}

export function verificationPath(certificateId: string): string {
  return `/certificates/${encodeURIComponent(certificateId)}`;
}
