import 'server-only';
import * as z from 'zod/v4';
import { grade, RULESET_VERSION, runRules, type SourceDocument } from '@/lib/audit/rules';
import { catalog, lineFactorSource } from '@/lib/emissions/catalog';
import { hashCanonical } from '@/lib/hashing';
import type { AiAudit, AuditFinding, DocumentRecord, EmissionData, InventoryLine } from '@/lib/types';
import type { RequestUser } from '../auth';
import { anchor } from '../hedera';
import { badRequest } from '../http';
import { one, supabaseAdmin } from '../supabase-admin';
import { inventoryHash } from '../services/certificates';
import { inventoryLines, loadOwnedInventory } from '../services/inventories';
import { aiConfigured, aiProvider } from './provider';
import { consumeAiQuota } from './rate-limit';

const AUDIT_PROMPT_VERSION = 'gt-audit-1.1';

const ReviewSchema = z.object({
  summary: z.string().describe('Two or three sentences for the inventory owner: overall quality and what to fix first.'),
  findings: z.array(
    z.object({
      severity: z.enum(['info', 'low', 'medium', 'high']),
      title: z.string(),
      detail: z.string().describe('Specific: name the line, the value and why it is suspicious.'),
      lineIds: z.array(z.string()),
      recommendation: z.string(),
    }),
  ),
});

const NATIONAL_GRIDS = catalog
  .filter((e) => e.country)
  .map((e) => e.country!.code)
  .join(', ');

const SYSTEM_PROMPT = `You are a greenhouse gas inventory auditor reviewing a Scope 1 and 2 inventory before it is certified on a public blockchain. Once certified it cannot be changed, so your job is to catch errors now.

Automated checks have already run; their findings are listed. Do not repeat them. Look for problems they cannot see:
- Implausible quantities for the stated organization, period and sources (for example a small office using 2 GWh of electricity in a month, which suggests kWh entered as MWh or Wh).
- Unit slips: litres vs gallons, kWh vs MWh, kg vs tonnes, therms vs kWh.
- Misclassification: generator diesel booked as Mobile, fleet fuel booked as Stationary, refrigerant system charge booked as leakage.
- Boundary and completeness gaps: periods missing from a monthly series, sites with gas but no electricity.
- Evidence problems: a value whose quoted evidence does not support the quantity.
- Grid electricity factor that does not fit the site country of its source document: another country's national grid factor, or the generic Grid Average when the catalog has a national grid factor for that country (${NATIONAL_GRIDS}). Grid Average is correct for any other country, or when the site country is unknown.

Severity guide: high = the total is materially wrong or something is counted twice; medium = likely error that changes a line noticeably; low = documentation or completeness gap; info = observation only.
Only report what the data supports. If the inventory looks sound, say so and return no findings. Reference lines by their id.`;

function factorText(line: InventoryLine): string {
  const source = lineFactorSource(line);
  const factor = `${line.factor} kg/${line.nativeUnit}`;
  return source ? `${factor} (${source.citation}, ${source.dataYear}, ${source.gas})` : factor;
}

function documentText(d: DocumentRecord): string {
  const extraction = (d.extraction ?? {}) as { siteAddress?: string | null; siteCountry?: string | null };
  return [d.id.slice(0, 8), d.file_name, extraction.siteAddress ?? 'not shown', extraction.siteCountry ?? 'not shown'].join(' | ');
}

function describeInventory(inventory: EmissionData, documents: DocumentRecord[]) {
  const lines = inventoryLines(inventory);
  return [
    `Organization: ${inventory.organization ?? 'unknown'}`,
    `Reporting period: ${inventory.reporting_period_start ?? '?'} to ${inventory.reporting_period_end ?? '?'}`,
    `Source of data: ${inventory.source}`,
    `Total: ${(Number(inventory.total_emissions) / 1000).toFixed(3)} t CO2e`,
    `Breakdown (kg CO2e): ${JSON.stringify(inventory.breakdown)}`,
    '',
    'Lines (id | scope / category / fuel | quantity as entered | native quantity | factor and source | kg CO2e | period | confidence | edited | document | evidence):',
    ...lines.map((l) =>
      [
        l.id,
        `${l.scope} / ${l.category} / ${l.fuelType}`,
        `${l.quantity} ${l.unit}`,
        `${l.nativeQuantity} ${l.nativeUnit}`,
        factorText(l),
        l.emissions.toFixed(2),
        `${l.periodStart ?? '?'}..${l.periodEnd ?? '?'}`,
        l.confidence ?? 'n/a',
        l.edited ? 'edited by user' : '',
        l.documentId ? l.documentId.slice(0, 8) : '',
        l.evidence ? `"${l.evidence.slice(0, 160)}"` : '',
      ].join(' | '),
    ),
    '',
    documents.length
      ? ['Source documents (id | file | site address | site country):', ...documents.map(documentText)].join('\n')
      : 'No source documents.',
  ].join('\n');
}

async function sourceDocuments(inventory: EmissionData): Promise<{ docs: DocumentRecord[]; ruleDocs: SourceDocument[] }> {
  const db = supabaseAdmin();
  const { data } = await db.from('documents').select('*').eq('emission_data_id', inventory.id);
  const docs = (data as DocumentRecord[]) ?? [];
  const fingerprints = docs.map((d) => d.fingerprint).filter((f): f is string => Boolean(f));

  // Same bill (by fingerprint) attached to a different inventory of this user.
  const reuse = new Map<string, { emissionDataId: string; certificateId: string | null }[]>();
  if (fingerprints.length) {
    const { data: others } = await db
      .from('documents')
      .select('fingerprint, emission_data_id')
      .eq('user_id', inventory.user_id)
      .in('fingerprint', fingerprints)
      .neq('emission_data_id', inventory.id)
      .not('emission_data_id', 'is', null);
    const otherInventoryIds = [...new Set((others ?? []).map((o) => o.emission_data_id as string))];
    const { data: certs } = otherInventoryIds.length
      ? await db.from('certificates').select('emission_data_id, certificate_id').in('emission_data_id', otherInventoryIds)
      : { data: [] };
    for (const other of others ?? []) {
      const cert = (certs ?? []).find((c) => c.emission_data_id === other.emission_data_id);
      const list = reuse.get(other.fingerprint) ?? [];
      list.push({ emissionDataId: other.emission_data_id, certificateId: cert?.certificate_id ?? null });
      reuse.set(other.fingerprint, list);
    }
  }

  return {
    docs,
    ruleDocs: docs.map((d) => ({ id: d.id, fileName: d.file_name, fingerprint: d.fingerprint, reusedIn: d.fingerprint ? reuse.get(d.fingerprint) : [] })),
  };
}

export async function auditInventory(user: RequestUser, emissionDataId: string): Promise<AiAudit> {
  const inventory = await loadOwnedInventory(user, emissionDataId);
  const lines = inventoryLines(inventory);
  if (lines.length === 0) throw badRequest('This inventory has no activity lines to audit.');

  const { docs, ruleDocs } = await sourceDocuments(inventory);
  const rules = runRules({ lines, source: inventory.source, documents: ruleDocs });
  const lineIds = new Set(lines.map((l) => l.id));

  let findings: AuditFinding[] = rules.findings;
  let summary: string;
  let model: string | null = null;

  if (aiConfigured()) {
    await consumeAiQuota(user.id, 'audit');
    const provider = await aiProvider();
    const review = await provider.generate({
      feature: 'inventory audit',
      system: SYSTEM_PROMPT,
      content: [
        {
          type: 'text',
          text: `${describeInventory(inventory, docs)}\n\nAutomated findings already reported:\n${
            rules.findings.length ? rules.findings.map((f) => `- [${f.severity}] ${f.title}: ${f.detail}`).join('\n') : '- none'
          }`,
        },
      ],
      schema: ReviewSchema,
      schemaName: 'inventory_review',
      effort: 'high',
    });
    model = review.model;
    summary = review.data.summary;
    findings = [
      ...rules.findings,
      ...review.data.findings.map((f, i) => ({
        id: `ai-${i + 1}`,
        check: 'ai-review',
        severity: f.severity,
        title: f.title,
        detail: f.detail,
        lineIds: f.lineIds.filter((id) => lineIds.has(id)),
        recommendation: f.recommendation,
      })),
    ];
  } else {
    summary = rules.findings.length
      ? `${rules.findings.length} automated check(s) need attention. Connect an AI provider for a full review.`
      : 'All automated checks passed. Connect an AI provider for a full review.';
  }

  const { score, level } = grade(findings);
  const checks = [...rules.checks, ...(model ? [{ check: 'ai-review', label: 'AI plausibility review', passed: !findings.some((f) => f.check === 'ai-review' && f.severity !== 'info') }] : [])];
  const inventoryDigest = await inventoryHash(inventory);
  const auditHash = await hashCanonical({ inventory: inventoryDigest, findings, score, level, ruleset: RULESET_VERSION, model, prompt: AUDIT_PROMPT_VERSION });
  const hcs = await anchor({
    type: 'AI_AUDIT',
    inventoryHash: inventoryDigest,
    auditHash,
    risk: level,
    score,
    findings: findings.length,
    model,
    ruleset: RULESET_VERSION,
  });

  return one(
    await supabaseAdmin()
      .from('ai_audits')
      .insert({
        user_id: user.id,
        emission_data_id: inventory.id,
        risk_score: score,
        risk_level: level,
        summary,
        findings,
        checks,
        model,
        ruleset_version: RULESET_VERSION,
        audit_hash: auditHash,
        hcs_tx_id: hcs.txId,
        hcs_sequence: hcs.sequence,
      })
      .select('*')
      .single<AiAudit>(),
    'Save audit',
  );
}
