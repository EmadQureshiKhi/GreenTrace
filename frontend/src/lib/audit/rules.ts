import type { AuditCheckResult, AuditFinding, FindingSeverity, InventoryLine } from '@/lib/types';
import { catalogKey } from '@/lib/emissions/catalog';

// Deterministic pre-mint checks. These run with or without an AI provider; the model reviews the
// inventory on top of them and adds findings, but it never removes one of these.

export const RULESET_VERSION = 'gt-audit-rules-1.0';

export interface SourceDocument {
  id: string;
  fileName: string;
  fingerprint: string | null;
  /** Inventory that already used a document with the same fingerprint, if any. */
  reusedIn?: { emissionDataId: string; certificateId: string | null }[];
}

export interface RuleContext {
  lines: InventoryLine[];
  source: 'calculator' | 'upload' | 'ai_extraction';
  documents: SourceDocument[];
}

export interface RuleResult {
  findings: AuditFinding[];
  checks: AuditCheckResult[];
}

const SEVERITY_WEIGHT: Record<FindingSeverity, number> = { info: 0, low: 5, medium: 15, high: 35 };

/** Score and level from findings. Shared by rule-only and AI-assisted audits so both grade the same way. */
export function grade(findings: AuditFinding[]): { score: number; level: 'low' | 'medium' | 'high' } {
  const score = Math.min(100, findings.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0));
  const level = findings.some((f) => f.severity === 'high') || score >= 60 ? 'high' : score >= 25 ? 'medium' : 'low';
  return { score, level };
}

function overlaps(a: InventoryLine, b: InventoryLine): boolean {
  if (!a.periodStart || !a.periodEnd || !b.periodStart || !b.periodEnd) return false;
  return a.periodStart <= b.periodEnd && b.periodStart <= a.periodEnd;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function runRules(ctx: RuleContext): RuleResult {
  const findings: AuditFinding[] = [];
  const checks: AuditCheckResult[] = [];
  const add = (f: Omit<AuditFinding, 'id'>) => findings.push({ ...f, id: `${f.check}-${findings.length + 1}` });
  const check = (id: string, label: string, before: number) => checks.push({ check: id, label, passed: findings.length === before });

  // 1. The same bill used twice (inside this inventory or in another one) is double counting.
  let before = findings.length;
  const seen = new Map<string, SourceDocument>();
  for (const doc of ctx.documents) {
    if (doc.fingerprint && seen.has(doc.fingerprint)) {
      add({
        check: 'duplicate-document',
        severity: 'high',
        title: 'The same bill appears twice',
        detail: `"${doc.fileName}" and "${seen.get(doc.fingerprint)!.fileName}" have the same supplier, account, invoice and billing period.`,
        lineIds: ctx.lines.filter((l) => l.documentId === doc.id).map((l) => l.id),
        recommendation: 'Remove one of the two documents so the activity is only counted once.',
      });
    }
    if (doc.fingerprint) seen.set(doc.fingerprint, doc);
    for (const reuse of doc.reusedIn ?? []) {
      add({
        check: 'duplicate-document',
        severity: reuse.certificateId ? 'high' : 'medium',
        title: reuse.certificateId ? 'Bill already certified in another inventory' : 'Bill already used in another inventory',
        detail: reuse.certificateId
          ? `"${doc.fileName}" was already counted in certificate ${reuse.certificateId}.`
          : `"${doc.fileName}" is also part of another draft inventory.`,
        lineIds: ctx.lines.filter((l) => l.documentId === doc.id).map((l) => l.id),
        recommendation: 'Each bill should back exactly one certificate. Remove it from this inventory or from the other one.',
      });
    }
  }
  check('duplicate-document', 'No bill is counted twice', before);

  // 2. Identical lines (same source, quantity and period) are almost always a double entry.
  before = findings.length;
  const lineKeys = new Map<string, InventoryLine>();
  for (const line of ctx.lines) {
    const key = [catalogKey(line), line.nativeQuantity, line.periodStart ?? '', line.periodEnd ?? ''].join('|');
    const first = lineKeys.get(key);
    if (first) {
      add({
        check: 'duplicate-line',
        severity: 'medium',
        title: 'Duplicate activity line',
        detail: `${line.fuelType}: ${line.quantity} ${line.unit} appears more than once for the same period.`,
        lineIds: [first.id, line.id],
        recommendation: 'Delete the duplicate unless these are genuinely separate meters or vehicles.',
      });
    } else {
      lineKeys.set(key, line);
    }
  }
  check('duplicate-line', 'No duplicate activity lines', before);

  // 3. Overlapping billing periods for the same source double count part of the period.
  before = findings.length;
  for (let i = 0; i < ctx.lines.length; i++) {
    for (let j = i + 1; j < ctx.lines.length; j++) {
      const a = ctx.lines[i];
      const b = ctx.lines[j];
      if (catalogKey(a) !== catalogKey(b) || !overlaps(a, b)) continue;
      if (a.documentId && a.documentId === b.documentId) continue;
      if (a.nativeQuantity === b.nativeQuantity && a.periodStart === b.periodStart && a.periodEnd === b.periodEnd) continue;
      add({
        check: 'period-overlap',
        severity: 'medium',
        title: 'Overlapping billing periods',
        detail: `${a.fuelType}: ${a.periodStart} to ${a.periodEnd} overlaps ${b.periodStart} to ${b.periodEnd}.`,
        lineIds: [a.id, b.id],
        recommendation: 'Confirm these are different meters or sites; otherwise the overlap is counted twice.',
      });
    }
  }
  check('period-overlap', 'Billing periods do not overlap', before);

  // 4. A single line dominating an otherwise ordinary inventory often signals a unit slip (kWh vs MWh).
  before = findings.length;
  if (ctx.lines.length >= 3) {
    for (const line of ctx.lines) {
      const others = ctx.lines.filter((l) => l !== line && l.emissions > 0).map((l) => l.emissions);
      const m = median(others);
      if (m > 0 && line.emissions > 50 * m) {
        add({
          check: 'magnitude-outlier',
          severity: 'medium',
          title: 'Unusually large line',
          detail: `${line.fuelType} (${line.quantity} ${line.unit}) is ${Math.round(line.emissions / m)}x the median line.`,
          lineIds: [line.id],
          recommendation: 'Check the unit and quantity against the source document.',
        });
      }
    }
  }
  check('magnitude-outlier', 'No line is an extreme outlier', before);

  // 5. AI-read values the model was unsure about and nobody reviewed.
  before = findings.length;
  const unsure = ctx.lines.filter((l) => l.documentId && !l.edited && l.confidence != null && l.confidence < 0.7);
  if (unsure.length) {
    add({
      check: 'low-confidence',
      severity: 'medium',
      title: 'Low-confidence values were not reviewed',
      detail: `${unsure.length} value(s) were read with low confidence and accepted without changes.`,
      lineIds: unsure.map((l) => l.id),
      recommendation: 'Compare these values with the documents and correct them if needed.',
    });
  }
  check('low-confidence', 'Uncertain AI readings were reviewed', before);

  // 6. Lines in an AI-extracted inventory must trace back to a document.
  before = findings.length;
  if (ctx.source === 'ai_extraction') {
    const orphan = ctx.lines.filter((l) => !l.documentId);
    if (orphan.length) {
      add({
        check: 'evidence',
        severity: 'low',
        title: 'Lines without a source document',
        detail: `${orphan.length} line(s) were added by hand and have no supporting document.`,
        lineIds: orphan.map((l) => l.id),
        recommendation: 'Attach the bill or invoice for these activities.',
      });
    }
  }
  check('evidence', 'Every extracted line has evidence', before);

  // 7. Zero lines add nothing but noise.
  before = findings.length;
  const zero = ctx.lines.filter((l) => l.quantity === 0);
  if (zero.length) {
    add({
      check: 'zero-quantity',
      severity: 'low',
      title: 'Zero-quantity lines',
      detail: `${zero.length} line(s) have a quantity of zero.`,
      lineIds: zero.map((l) => l.id),
      recommendation: 'Remove them or enter the real quantity.',
    });
  }
  check('zero-quantity', 'No empty lines', before);

  // 8. Completeness: almost every organization buys electricity.
  before = findings.length;
  if (ctx.lines.length > 0 && !ctx.lines.some((l) => l.scope === 'Scope 2')) {
    add({
      check: 'scope-coverage',
      severity: 'low',
      title: 'No Scope 2 (purchased energy) reported',
      detail: 'The inventory has no electricity, heat, steam or cooling.',
      lineIds: [],
      recommendation: 'Add purchased energy, or note why it is outside the boundary.',
    });
  }
  check('scope-coverage', 'Scope 1 and Scope 2 are both covered', before);

  // 9. Refrigerant top-ups above a tonne are rare outside industrial sites.
  before = findings.length;
  for (const line of ctx.lines.filter((l) => l.category === 'Fugitive' && l.nativeQuantity > 1000)) {
    add({
      check: 'refrigerant-magnitude',
      severity: 'medium',
      title: 'Very large refrigerant loss',
      detail: `${line.nativeQuantity} kg of ${line.fuelType} is unusual.`,
      lineIds: [line.id],
      recommendation: 'Confirm the quantity is kg of gas lost, not system charge or grams.',
    });
  }
  check('refrigerant-magnitude', 'Refrigerant losses are plausible', before);

  return { findings, checks };
}
