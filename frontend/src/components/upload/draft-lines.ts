import { tryComputeLine, type ComputeResult } from '@/components/inventory/inventory-utils';
import type { InventoryLinePayload } from '@/hooks/use-api';
import type { ExtractedLine } from '@/hooks/use-measure';
import type { DocumentRecord } from '@/lib/types';

// An activity line while it is being reviewed, before the inventory is created. Values are kept as the
// person typed them (strings) so half-typed input does not jump around; evaluateDraft turns them into
// a computed line or an explanation of what is wrong.

export interface DraftOriginal {
  catalogId: string | null;
  quantity: number;
  unit: string;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface DraftLine {
  /** React key, unique within the page. */
  key: string;
  /** Line id sent to the server. */
  id: string;
  catalogId: string | null;
  quantity: string;
  unit: string;
  periodStart: string;
  periodEnd: string;
  documentId: string | null;
  fileName: string | null;
  description: string | null;
  evidence: string | null;
  page: number | null;
  confidence: number | null;
  reasoning: string | null;
  /** Problem found when the line was read or imported. Shown until the line computes. */
  issue: string | null;
  /** What the AI read. Null for lines a person added or imported from a spreadsheet. */
  original: DraftOriginal | null;
  /** 1-based data row in the source spreadsheet. */
  sourceRow: number | null;
}

let counter = 0;
function localKey(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function draftFromExtracted(line: ExtractedLine, document: DocumentRecord): DraftLine {
  return {
    key: localKey(line.id),
    id: line.id,
    catalogId: line.catalogId,
    quantity: String(line.quantity),
    unit: line.unit,
    periodStart: line.periodStart ?? '',
    periodEnd: line.periodEnd ?? '',
    documentId: document.id,
    fileName: document.file_name,
    description: line.description,
    evidence: line.evidence,
    page: line.page,
    confidence: line.confidence,
    reasoning: line.reasoning,
    issue: line.issue,
    original: {
      catalogId: line.catalogId,
      quantity: line.quantity,
      unit: line.unit,
      periodStart: line.periodStart,
      periodEnd: line.periodEnd,
    },
    sourceRow: null,
  };
}

export function manualDraft(defaults: Partial<DraftLine> = {}): DraftLine {
  const key = localKey('manual');
  return {
    key,
    id: `manual-${crypto.randomUUID().slice(0, 8)}`,
    catalogId: null,
    quantity: '',
    unit: '',
    periodStart: '',
    periodEnd: '',
    documentId: null,
    fileName: null,
    description: null,
    evidence: null,
    page: null,
    confidence: null,
    reasoning: null,
    issue: null,
    original: null,
    sourceRow: null,
    ...defaults,
  };
}

/** True when a person changed the source, quantity, unit or period the AI read. */
export function isEdited(line: DraftLine): boolean {
  const o = line.original;
  if (!o) return false;
  return (
    line.catalogId !== o.catalogId ||
    Number(line.quantity) !== o.quantity ||
    line.unit !== o.unit ||
    (line.periodStart || null) !== (o.periodStart || null) ||
    (line.periodEnd || null) !== (o.periodEnd || null)
  );
}

export function evaluateDraft(line: DraftLine): ComputeResult {
  if (!line.catalogId) return { ok: false, error: 'Choose an emission source.' };
  if (line.quantity.trim() === '') return { ok: false, error: 'Enter a quantity.' };
  const quantity = Number(line.quantity);
  if (!Number.isFinite(quantity)) return { ok: false, error: 'Quantity must be a number.' };
  if (!line.unit) return { ok: false, error: 'Choose a unit.' };
  if (line.periodStart && line.periodEnd && line.periodEnd < line.periodStart) {
    return { ok: false, error: 'Period ends before it starts.' };
  }
  return tryComputeLine({ id: line.id, catalogId: line.catalogId, quantity, unit: line.unit });
}

export function draftToPayload(line: DraftLine): InventoryLinePayload {
  return {
    id: line.id,
    catalogId: line.catalogId ?? '',
    quantity: Number(line.quantity),
    unit: line.unit,
    periodStart: line.periodStart || null,
    periodEnd: line.periodEnd || null,
    documentId: line.documentId,
    evidence: line.evidence ? line.evidence.slice(0, 2000) : null,
    confidence: line.confidence,
    edited: isEdited(line),
    description: line.description ? line.description.slice(0, 500) : null,
  };
}
