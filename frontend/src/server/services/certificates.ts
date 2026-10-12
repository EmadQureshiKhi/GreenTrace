import 'server-only';
import * as z from 'zod';
import { chainConfig } from '@/lib/chain-config';
import { hashCanonical } from '@/lib/hashing';
import type { AiAudit, Certificate, EmissionData, Retirement } from '@/lib/types';
import type { RequestUser } from '../auth';
import { anchor, mintCertificateNft } from '../hedera';
import { badRequest, conflict, notFound } from '../http';
import { loadJson, storeJson } from '../ipfs';
import { decodeBase64, getNft, getTopicMessage } from '../mirror';
import { must, one, supabaseAdmin } from '../supabase-admin';

export const issueCertificateInput = z.object({
  emissionDataId: z.string().uuid(),
  title: z.string().trim().min(3).max(140).optional(),
});

/** The part of an inventory a certificate attests to. Its hash is what goes on chain. */
export function inventoryAttestation(inventory: EmissionData) {
  return {
    id: inventory.id,
    source: inventory.source,
    organization: inventory.organization,
    reportingPeriodStart: inventory.reporting_period_start,
    reportingPeriodEnd: inventory.reporting_period_end,
    totalEmissionsKg: Number(inventory.total_emissions),
    breakdown: inventory.breakdown,
    lines: inventory.processed_data,
  };
}

export function inventoryHash(inventory: EmissionData): Promise<string> {
  return hashCanonical(inventoryAttestation(inventory));
}

function newCertificateId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const suffix = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `GT-${new Date().getUTCFullYear()}-${suffix}`;
}

/** The latest audit of an inventory, if it was run on the inventory's current contents. */
export async function currentAudit(inventory: EmissionData): Promise<AiAudit | null> {
  const { data } = await supabaseAdmin()
    .from('ai_audits')
    .select('*')
    .eq('emission_data_id', inventory.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<AiAudit>();
  if (!data || Date.parse(data.created_at) < Date.parse(inventory.updated_at)) return null;
  return data;
}

export async function issueCertificate(user: RequestUser, input: z.infer<typeof issueCertificateInput>): Promise<Certificate> {
  const db = supabaseAdmin();
  const inventory = must(
    await db.from('emission_data').select('*').eq('id', input.emissionDataId).eq('user_id', user.id).maybeSingle<EmissionData>(),
    'Load inventory',
  );
  if (!inventory) throw notFound('Inventory not found.');
  if (!Array.isArray(inventory.processed_data) || inventory.processed_data.length === 0) {
    throw badRequest('This inventory has no activity data.');
  }

  const { data: existing } = await db.from('certificates').select('certificate_id').eq('emission_data_id', inventory.id).maybeSingle();
  if (existing) throw conflict(`This inventory is already certified as ${existing.certificate_id}.`);

  const audit = await currentAudit(inventory);
  if (!audit) throw badRequest('Run the AI audit on this inventory before issuing a certificate.');
  if (audit.risk_level === 'high') throw badRequest('The audit found high-risk issues. Resolve them and re-run the audit first.');

  const dataHash = await inventoryHash(inventory);
  const certificateId = newCertificateId();
  const organization = inventory.organization || user.profile.organization || user.profile.display_name || 'Organization';
  const title = input.title || `${organization} GHG emissions certificate`;
  const issuedAt = new Date().toISOString();

  // HIP-412 style metadata. The NFT stores only its URI; the content is addressed by hash.
  const metadata = {
    name: title,
    description: `Verified Scope 1 and 2 greenhouse gas inventory for ${organization}, issued by GreenTrace.`,
    type: 'application/json',
    format: 'HIP412@2.0.0',
    properties: {
      certificateId,
      organization,
      totalEmissionsKgCO2e: Number(inventory.total_emissions),
      breakdownKgCO2e: inventory.breakdown,
      reportingPeriod: { start: inventory.reporting_period_start, end: inventory.reporting_period_end },
      inventoryHash: dataHash,
      audit: { id: audit.id, hash: audit.audit_hash, riskLevel: audit.risk_level, riskScore: audit.risk_score, hcsSequence: audit.hcs_sequence },
      issuedAt,
      issuer: 'GreenTrace',
    },
  };
  const stored = await storeJson(`certificate-${certificateId}`, metadata);
  const nft = await mintCertificateNft(stored.uri);
  const hcs = await anchor({
    type: 'CERTIFICATE_ISSUED',
    certificateId,
    inventoryHash: dataHash,
    totalEmissionsKg: Number(inventory.total_emissions),
    metadataCid: stored.cid,
    nft: { token: chainConfig.certificateTokenId, serial: nft.serial },
    auditHash: audit.audit_hash,
  });

  return one(
    await db
      .from('certificates')
      .insert({
        user_id: user.id,
        emission_data_id: inventory.id,
        audit_id: audit.id,
        certificate_id: certificateId,
        title,
        organization,
        total_emissions: inventory.total_emissions,
        breakdown: inventory.breakdown,
        data_hash: dataHash,
        metadata_cid: stored.cid,
        metadata_pinned: stored.pinned,
        nft_token_id: chainConfig.certificateTokenId,
        nft_serial: nft.serial,
        nft_tx_id: nft.txId,
        hcs_tx_id: hcs.txId,
        hcs_sequence: hcs.sequence,
      })
      .select('*')
      .single<Certificate>(),
    'Save certificate',
  );
}

export type CheckStatus = 'pass' | 'fail' | 'pending';

export interface VerificationCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface CertificateVerification {
  certificate: Certificate;
  inventory: Pick<EmissionData, 'id' | 'source' | 'reporting_period_start' | 'reporting_period_end' | 'processed_data'> | null;
  audit: AiAudit | null;
  retirements: Retirement[];
  checks: VerificationCheck[];
  verified: boolean;
}

/**
 * Independently re-derives everything a certificate claims, from public sources:
 * the inventory hash, the consensus-log entry, the NFT on chain, and the content-addressed metadata.
 */
export async function verifyCertificate(certificateId: string): Promise<CertificateVerification> {
  const db = supabaseAdmin();
  const certificate = must(
    await db.from('certificates').select('*').eq('certificate_id', certificateId).maybeSingle<Certificate>(),
    'Load certificate',
  );
  if (!certificate) throw notFound('No certificate with that id.');

  const [{ data: inventory }, { data: audit }, { data: retirements }] = await Promise.all([
    db.from('emission_data').select('*').eq('id', certificate.emission_data_id).maybeSingle<EmissionData>(),
    certificate.audit_id
      ? db.from('ai_audits').select('*').eq('id', certificate.audit_id).maybeSingle<AiAudit>()
      : Promise.resolve({ data: null }),
    db.from('retirements').select('*').eq('certificate_id', certificate.id).order('created_at', { ascending: false }),
  ]);

  const checks: VerificationCheck[] = [];

  const recomputed = inventory ? await inventoryHash(inventory) : null;
  checks.push({
    id: 'inventory-hash',
    label: 'Inventory matches the certified hash',
    status: recomputed === certificate.data_hash ? 'pass' : 'fail',
    detail: recomputed === certificate.data_hash ? `sha256 ${certificate.data_hash}` : 'The stored inventory no longer hashes to the certified value.',
  });

  if (certificate.hcs_sequence && chainConfig.topicId) {
    const message = await getTopicMessage(chainConfig.topicId, certificate.hcs_sequence);
    let body: Record<string, unknown> | null = null;
    try {
      body = message ? JSON.parse(decodeBase64(message.message)) : null;
    } catch {
      body = null;
    }
    const ok = body?.certificateId === certificate.certificate_id && body?.inventoryHash === certificate.data_hash;
    checks.push({
      id: 'consensus-log',
      label: 'Hedera Consensus Service record',
      status: !message ? 'pending' : ok ? 'pass' : 'fail',
      detail: !message
        ? 'The mirror node has not indexed this message yet.'
        : ok
          ? `Topic ${chainConfig.topicId}, message #${certificate.hcs_sequence}, consensus ${message.consensus_timestamp}`
          : 'The logged hash differs from the certificate.',
    });
  }

  if (certificate.nft_token_id && certificate.nft_serial) {
    const nft = await getNft(certificate.nft_token_id, certificate.nft_serial);
    const uri = nft ? decodeBase64(nft.metadata) : null;
    const ok = uri === `ipfs://${certificate.metadata_cid}`;
    checks.push({
      id: 'nft',
      label: 'Certificate NFT on Hedera',
      status: !nft ? 'pending' : ok && !nft.deleted ? 'pass' : 'fail',
      detail: !nft
        ? 'The mirror node has not indexed this NFT yet.'
        : ok
          ? `Token ${certificate.nft_token_id} serial #${certificate.nft_serial} points to ${uri}`
          : 'The NFT metadata does not point to this certificate.',
    });
  }

  if (certificate.metadata_cid) {
    const content = await loadJson(certificate.metadata_cid);
    const props = (content?.properties ?? {}) as Record<string, unknown>;
    const ok = props.inventoryHash === certificate.data_hash && props.certificateId === certificate.certificate_id;
    checks.push({
      id: 'metadata',
      label: certificate.metadata_pinned ? 'IPFS metadata (pinned)' : 'Content-addressed metadata',
      status: ok ? 'pass' : 'fail',
      detail: ok ? `CID ${certificate.metadata_cid}` : 'The metadata does not match the certificate.',
    });
  }

  if (audit) {
    checks.push({
      id: 'audit',
      label: 'AI audit before issuance',
      status: audit.risk_level === 'high' ? 'fail' : 'pass',
      detail: `${audit.risk_level} risk (score ${audit.risk_score}/100), ${audit.findings.length} finding(s)`,
    });
  }

  return {
    certificate,
    inventory: inventory
      ? {
          id: inventory.id,
          source: inventory.source,
          reporting_period_start: inventory.reporting_period_start,
          reporting_period_end: inventory.reporting_period_end,
          processed_data: inventory.processed_data,
        }
      : null,
    audit: audit ?? null,
    retirements: (retirements as Retirement[]) ?? [],
    checks,
    // Verified only when every check passes; a record the mirror node has not indexed yet is pending, not verified.
    verified: checks.length > 0 && checks.every((c) => c.status === 'pass'),
  };
}
