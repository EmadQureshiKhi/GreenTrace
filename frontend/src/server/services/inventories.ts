import 'server-only';
import * as z from 'zod';
import { computeLine, totals } from '@/lib/emissions/catalog';
import { UnitError } from '@/lib/emissions/units';
import type { EmissionData, InventoryLine } from '@/lib/types';
import type { RequestUser } from '../auth';
import { badRequest, conflict, notFound } from '../http';
import { must, one, supabaseAdmin } from '../supabase-admin';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const lineInput = z.object({
  id: z.string().min(1).max(64),
  catalogId: z.string().min(1),
  quantity: z.number().finite().nonnegative(),
  unit: z.string().min(1),
  periodStart: isoDate.nullish(),
  periodEnd: isoDate.nullish(),
  documentId: z.string().uuid().nullish(),
  evidence: z.string().max(2000).nullish(),
  confidence: z.number().min(0).max(1).nullish(),
  edited: z.boolean().optional(),
  description: z.string().max(500).nullish(),
});

export const inventoryInput = z.object({
  source: z.enum(['calculator', 'upload', 'ai_extraction']),
  organization: z.string().trim().min(1).max(200),
  fileName: z.string().max(255).nullish(),
  reportingPeriodStart: isoDate.nullish(),
  reportingPeriodEnd: isoDate.nullish(),
  lines: z.array(lineInput).min(1).max(2000),
  /** Original rows or questionnaire answers, kept for reference. */
  rawData: z.array(z.unknown()).max(5000).optional(),
});

export type InventoryInput = z.infer<typeof inventoryInput>;

function computeAll(lines: InventoryInput['lines']): InventoryLine[] {
  const ids = new Set<string>();
  return lines.map((line, index) => {
    if (ids.has(line.id)) throw badRequest(`Line ${index + 1}: duplicate line id.`);
    ids.add(line.id);
    try {
      return computeLine(line);
    } catch (error) {
      if (error instanceof UnitError) throw badRequest(`Line ${index + 1}: ${error.message}`);
      throw error;
    }
  });
}

/**
 * Checks the documents the lines cite belong to the user and are free to use here. A bill that backs a
 * certified inventory can never be reused (that would count it twice); a bill in an uncertified draft
 * moves to this inventory.
 */
async function assertDocumentsUsable(user: RequestUser, lines: InventoryLine[], inventoryId?: string): Promise<string[]> {
  const documentIds = [...new Set(lines.map((l) => l.documentId).filter((id): id is string => Boolean(id)))];
  if (documentIds.length === 0) return [];
  const db = supabaseAdmin();
  const { data } = await db.from('documents').select('id, file_name, emission_data_id, fingerprint').eq('user_id', user.id).in('id', documentIds);
  if ((data?.length ?? 0) !== documentIds.length) throw badRequest('A line references a document you did not upload.');

  // The same bill can arrive as a different file (a scan, a re-download): match on its fingerprint too.
  const fingerprints = (data ?? []).map((d) => d.fingerprint).filter((f): f is string => Boolean(f));
  const { data: copies } = fingerprints.length
    ? await db.from('documents').select('id, file_name, emission_data_id, fingerprint').eq('user_id', user.id).in('fingerprint', fingerprints).not('id', 'in', `(${documentIds.join(',')})`)
    : { data: [] };

  const elsewhere = [...(data ?? []), ...(copies ?? [])].filter((d) => d.emission_data_id && d.emission_data_id !== inventoryId);
  if (elsewhere.length) {
    const { data: certified } = await db
      .from('certificates')
      .select('emission_data_id, certificate_id')
      .in('emission_data_id', elsewhere.map((d) => d.emission_data_id as string));
    const blocking = elsewhere.find((d) => certified?.some((c) => c.emission_data_id === d.emission_data_id));
    if (blocking) {
      const cert = certified!.find((c) => c.emission_data_id === blocking.emission_data_id)!;
      throw conflict(`"${blocking.file_name}" is already counted in certificate ${cert.certificate_id}. Remove its lines to avoid double counting.`);
    }
  }
  return documentIds;
}

function row(user: RequestUser, input: InventoryInput, lines: InventoryLine[]) {
  const { total, breakdown } = totals(lines);
  return {
    user_id: user.id,
    source: input.source,
    organization: input.organization,
    file_name: input.fileName ?? null,
    reporting_period_start: input.reportingPeriodStart ?? null,
    reporting_period_end: input.reportingPeriodEnd ?? null,
    total_emissions: total,
    breakdown,
    processed_data: lines,
    raw_data: input.rawData ?? [],
    status: 'completed',
  };
}

export async function createInventory(user: RequestUser, input: InventoryInput): Promise<EmissionData> {
  const lines = computeAll(input.lines);
  const documentIds = await assertDocumentsUsable(user, lines);
  const db = supabaseAdmin();
  const inventory = one(
    await db.from('emission_data').insert(row(user, input, lines)).select('*').single<EmissionData>(),
    'Create inventory',
  );
  if (documentIds.length) {
    must(await db.from('documents').update({ emission_data_id: inventory.id }).in('id', documentIds), 'Link documents');
  }
  return inventory;
}

export async function updateInventory(user: RequestUser, id: string, input: InventoryInput): Promise<EmissionData> {
  const db = supabaseAdmin();
  const existing = must(
    await db.from('emission_data').select('id').eq('id', id).eq('user_id', user.id).maybeSingle(),
    'Load inventory',
  );
  if (!existing) throw notFound('Inventory not found.');
  const { data: certificate } = await db.from('certificates').select('certificate_id').eq('emission_data_id', id).maybeSingle();
  if (certificate) throw conflict(`This inventory is certified as ${certificate.certificate_id} and can no longer change.`);

  const lines = computeAll(input.lines);
  const documentIds = await assertDocumentsUsable(user, lines, id);
  const updated = one(
    await db.from('emission_data').update(row(user, input, lines)).eq('id', id).select('*').single<EmissionData>(),
    'Update inventory',
  );
  must(await db.from('documents').update({ emission_data_id: null }).eq('emission_data_id', id), 'Unlink documents');
  if (documentIds.length) {
    must(await db.from('documents').update({ emission_data_id: id }).in('id', documentIds), 'Link documents');
  }
  return updated;
}

export async function loadOwnedInventory(user: RequestUser, id: string): Promise<EmissionData> {
  const inventory = must(
    await supabaseAdmin().from('emission_data').select('*').eq('id', id).eq('user_id', user.id).maybeSingle<EmissionData>(),
    'Load inventory',
  );
  if (!inventory) throw notFound('Inventory not found.');
  return inventory;
}

/** Inventory lines in the current format. Older rows may hold rows from the CSV importer. */
export function inventoryLines(inventory: EmissionData): InventoryLine[] {
  const lines = Array.isArray(inventory.processed_data) ? inventory.processed_data : [];
  return lines.filter((l): l is InventoryLine => typeof (l as InventoryLine).emissions === 'number' && typeof (l as InventoryLine).fuelType === 'string');
}

/** Deletes a draft inventory. Its documents stay (unlinked) so their readings can be reused. */
export async function deleteInventory(user: RequestUser, id: string): Promise<void> {
  const db = supabaseAdmin();
  await loadOwnedInventory(user, id);
  const { data: certificate } = await db.from('certificates').select('certificate_id').eq('emission_data_id', id).maybeSingle();
  if (certificate) throw conflict(`This inventory is certified as ${certificate.certificate_id} and cannot be deleted.`);
  must(await db.from('emission_data').delete().eq('id', id).eq('user_id', user.id), 'Delete inventory');
}
