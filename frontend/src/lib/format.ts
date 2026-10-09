// Display helpers shared across pages.

export function formatTonnes(kg: number, digits = 2): string {
  return `${(kg / 1000).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })} t`;
}

export function formatKg(kg: number): string {
  return `${kg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`;
}

export function formatHbar(hbar: number): string {
  return `${hbar.toLocaleString(undefined, { maximumFractionDigits: 4 })} HBAR`;
}

export function shortHash(value: string | null | undefined, head = 6, tail = 4): string {
  if (!value) return '';
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) return String((error as { message: unknown }).message);
  return String(error);
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** One date style across the app: "1 Jan 2026". Date-only strings (YYYY-MM-DD) are read as UTC days. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : DATE_FORMAT.format(date);
}
