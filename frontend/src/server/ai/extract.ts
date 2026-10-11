import 'server-only';
import { computeLine, getCatalogEntry } from '@/lib/emissions/catalog';
import { UnitError } from '@/lib/emissions/units';
import { hashCanonical, sha256Hex } from '@/lib/hashing';
import type { DocumentRecord, InventoryLine } from '@/lib/types';
import type { RequestUser } from '../auth';
import { anchor } from '../hedera';
import { badRequest } from '../http';
import { must, one, supabaseAdmin } from '../supabase-admin';
import { aiProvider, type ContentPart } from './provider';
import {
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_SYSTEM_PROMPT,
  ExtractionSchema,
  extractionRequestText,
  gridFactorWarnings,
  type Extraction,
} from './extraction-prompt';
import { consumeAiQuota } from './rate-limit';

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const MEDIA_TYPES = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const;
export type SupportedMediaType = keyof typeof MEDIA_TYPES;

const normalize = (value: string | null | undefined) => (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Supplier + account/invoice + period. Two files with the same fingerprint are the same bill. */
export function documentFingerprint(x: Pick<Extraction, 'supplier' | 'accountNumber' | 'invoiceNumber' | 'billingPeriodStart' | 'billingPeriodEnd'>): string | null {
  const supplier = normalize(x.supplier);
  const reference = normalize(x.invoiceNumber) || normalize(x.accountNumber);
  const period = `${x.billingPeriodStart ?? ''}..${x.billingPeriodEnd ?? ''}`;
  if (!supplier || !reference) return null;
  if (!normalize(x.invoiceNumber) && period === '..') return null;
  return `${supplier}|${reference}|${period}`;
}

export interface ExtractedLine {
  id: string;
  description: string;
  catalogId: string | null;
  quantity: number;
  unit: string;
  periodStart: string | null;
  periodEnd: string | null;
  evidence: string;
  page: number | null;
  confidence: number;
  reasoning: string;
  /** Set when the line could not be computed as read; the reviewer must fix it. */
  issue: string | null;
  computed: InventoryLine | null;
}

export function toExtractedLines(documentId: string, extraction: Extraction): ExtractedLine[] {
  return extraction.lineItems.map((item, index) => {
    const id = `${documentId.slice(0, 8)}-${index + 1}`;
    const confidence = Math.max(0, Math.min(1, item.confidence));
    const periodStart = item.periodStart ?? extraction.billingPeriodStart;
    const periodEnd = item.periodEnd ?? extraction.billingPeriodEnd;
    const base = {
      id,
      description: item.description,
      catalogId: item.catalogId,
      quantity: item.quantity,
      unit: item.unit,
      periodStart,
      periodEnd,
      evidence: item.evidence,
      page: item.page,
      confidence,
      reasoning: item.reasoning,
    };
    if (!item.catalogId || !getCatalogEntry(item.catalogId)) {
      return { ...base, issue: 'No matching emission source. Choose one.', computed: null };
    }
    if (item.quantity < 0) {
      return { ...base, issue: 'Negative quantity (credit or correction). Confirm how to treat it.', computed: null };
    }
    try {
      const computed = computeLine({
        id,
        catalogId: item.catalogId,
        quantity: item.quantity,
        unit: item.unit,
        periodStart,
        periodEnd,
        documentId,
        evidence: item.evidence,
        confidence,
        description: item.description,
      });
      return { ...base, issue: null, computed };
    } catch (error) {
      return { ...base, issue: error instanceof UnitError ? error.message : 'Could not compute this line.', computed: null };
    }
  });
}

/** Another document that is the same bill (same fingerprint), preferring one already in an inventory. */
async function findTwin(userId: string, fingerprint: string | null, excludeId: string): Promise<ExtractionResult['duplicateOf']> {
  if (!fingerprint) return null;
  const { data } = await supabaseAdmin()
    .from('documents')
    .select('id, file_name, emission_data_id')
    .eq('user_id', userId)
    .eq('fingerprint', fingerprint)
    .neq('id', excludeId);
  const twins = data ?? [];
  const twin = twins.find((t) => t.emission_data_id) ?? twins[0];
  return twin ? { id: twin.id, fileName: twin.file_name, kind: 'same-bill', inventoryId: twin.emission_data_id } : null;
}

export interface ExtractionResult {
  document: DocumentRecord;
  lines: ExtractedLine[];
  warnings: string[];
  /**
   * Another upload of the same bill, if any. `inventoryId` is set when that copy is already part of an
   * inventory, i.e. already counted; a copy from an abandoned upload is not.
   */
  duplicateOf: { id: string; fileName: string; kind: 'identical-file' | 'same-bill'; inventoryId: string | null } | null;
}

export async function extractDocument(
  user: RequestUser,
  file: { name: string; type: string; bytes: Uint8Array },
): Promise<ExtractionResult> {
  const ext = MEDIA_TYPES[file.type as SupportedMediaType];
  if (!ext) throw badRequest('Upload a PDF, PNG, JPEG or WebP file.');
  if (file.bytes.byteLength === 0) throw badRequest('The file is empty.');
  if (file.bytes.byteLength > MAX_DOCUMENT_BYTES) throw badRequest('Files must be 10 MB or smaller.');

  const db = supabaseAdmin();
  const sha256 = await sha256Hex(file.bytes);

  // The identical file was uploaded before: return the earlier reading instead of paying for it twice.
  const { data: same } = await db.from('documents').select('*').eq('user_id', user.id).eq('sha256', sha256).maybeSingle<DocumentRecord>();
  if (same) {
    const extraction = same.extraction as Extraction | null;
    // Prefer reporting where the bill is already counted: this file, or another copy of the same bill.
    const twin = same.emission_data_id ? null : await findTwin(user.id, same.fingerprint, same.id);
    return {
      document: same,
      lines: extraction ? toExtractedLines(same.id, extraction) : [],
      warnings: extraction ? [...extraction.warnings, ...gridFactorWarnings(extraction)] : [],
      duplicateOf: twin?.inventoryId
        ? twin
        : { id: same.id, fileName: same.file_name, kind: 'identical-file', inventoryId: same.emission_data_id },
    };
  }

  await consumeAiQuota(user.id, 'extract');
  const provider = await aiProvider('extraction');
  const base64 = Buffer.from(file.bytes).toString('base64');
  const filePart: ContentPart =
    ext === 'pdf'
      ? { type: 'pdf', name: file.name, base64 }
      : { type: 'image', name: file.name, mediaType: file.type as 'image/png' | 'image/jpeg' | 'image/webp', base64 };

  const documentId = crypto.randomUUID();
  const storagePath = `${user.id}/${sha256}.${ext}`;
  const upload = await db.storage.from('documents').upload(storagePath, Buffer.from(file.bytes), { contentType: file.type, upsert: true });
  if (upload.error) throw new Error(`Store document: ${upload.error.message}`);

  let extraction: Extraction;
  let model: string;
  try {
    const result = await provider.generate({
      feature: 'document extraction',
      system: EXTRACTION_SYSTEM_PROMPT,
      content: [filePart, { type: 'text', text: extractionRequestText(file.name) }],
      schema: ExtractionSchema,
      schemaName: 'activity_extraction',
      effort: 'high',
    });
    extraction = result.data;
    model = result.model;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    must(
      await db.from('documents').insert({
        id: documentId,
        user_id: user.id,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.bytes.byteLength,
        sha256,
        storage_path: storagePath,
        status: 'failed',
        error: message,
        prompt_version: EXTRACTION_PROMPT_VERSION,
      }),
      'Record failed extraction',
    );
    throw error;
  }

  const fingerprint = extraction.isActivityDocument ? documentFingerprint(extraction) : null;
  const extractionHash = await hashCanonical({ document: sha256, extraction });
  const hcs = await anchor({
    type: 'AI_EXTRACTION',
    documentSha256: sha256,
    extractionHash,
    model,
    prompt: EXTRACTION_PROMPT_VERSION,
  });

  const document = one(
    await db
      .from('documents')
      .insert({
        id: documentId,
        user_id: user.id,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.bytes.byteLength,
        sha256,
        storage_path: storagePath,
        fingerprint,
        status: 'extracted',
        extraction,
        model,
        prompt_version: EXTRACTION_PROMPT_VERSION,
        extraction_hash: extractionHash,
        hcs_tx_id: hcs.txId,
        hcs_sequence: hcs.sequence,
      })
      .select('*')
      .single<DocumentRecord>(),
    'Save extraction',
  );

  const duplicateOf = await findTwin(user.id, fingerprint, document.id);

  const warnings = [...extraction.warnings, ...gridFactorWarnings(extraction)];
  if (!extraction.isActivityDocument) warnings.unshift('This does not look like a bill or invoice with consumption data.');

  return { document, lines: toExtractedLines(document.id, extraction), warnings, duplicateOf };
}
