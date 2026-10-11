import 'server-only';
import * as z from 'zod/v4';
import { baseSampleSize } from '@/components/sema/sema-types';
import { hashCanonical } from '@/lib/hashing';
import type { Certificate, GriDraft } from '@/lib/types';
import type { RequestUser } from '../auth';
import { anchor } from '../hedera';
import { badRequest, notFound } from '../http';
import { must, one, supabaseAdmin } from '../supabase-admin';
import { aiProvider } from './provider';
import { consumeAiQuota } from './rate-limit';

const DraftSchema = z.object({
  summary: z.string().describe('One paragraph overview of what the draft covers and its main gaps.'),
  disclosures: z.array(
    z.object({
      code: z.string().describe('GRI disclosure code, e.g. "GRI 3-1"'),
      title: z.string(),
      content: z.string().describe('Report-ready prose in Markdown. Use [DATA NEEDED: ...] where facts are missing.'),
      sources: z.array(z.string()).describe('Which inputs this text is based on'),
    }),
  ),
  dataGaps: z.array(z.string()),
});


const SYSTEM_PROMPT = `You draft sustainability report disclosures under the GRI Standards (GRI 1: Foundation 2021, GRI 2: General Disclosures 2021, GRI 3: Material Topics 2021, GRI 305: Emissions 2016).

Write the following, in this order:
- GRI 2-29 Approach to stakeholder engagement (from the stakeholder data)
- GRI 3-1 Process to determine material topics (from the assessment method: stakeholder scoring, survey sample, internal severity x likelihood)
- GRI 3-2 List of material topics
- GRI 3-3 Management of material topics, one disclosure per material topic
- GRI 305-1 Direct (Scope 1) and GRI 305-2 Energy indirect (Scope 2) GHG emissions, only if emissions data is provided

Rules: use only the facts given. Never invent numbers, targets, policies or initiatives. Where the standard asks for something the data does not contain, write [DATA NEEDED: what is missing] and list it in dataGaps. Write in a neutral, report-ready voice in the third person, using the organization's name.`;

export async function draftGri(user: RequestUser, clientId: string): Promise<GriDraft> {
  const db = supabaseAdmin();
  const client = must(await db.from('sema_clients').select('*').eq('id', clientId).eq('user_id', user.id).maybeSingle(), 'Load client');
  if (!client) throw notFound('Organization not found.');

  const [stakeholders, materialTopics, internalTopics, sample, certificates] = await Promise.all([
    db.from('sema_stakeholders').select('*').eq('client_id', clientId),
    db.from('sema_material_topics').select('*').eq('client_id', clientId),
    db.from('sema_internal_topics').select('*').eq('client_id', clientId),
    db.from('sema_sample_parameters').select('*').eq('client_id', clientId).maybeSingle(),
    db.from('certificates').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
  ]);
  if (!materialTopics.data?.length && !internalTopics.data?.length) {
    throw badRequest('Add material topics in the SEMA tool before drafting disclosures.');
  }
  const latest = (certificates.data as Certificate[] | null)?.[0];

  await consumeAiQuota(user.id, 'gri-draft');
  const provider = await aiProvider();
  const facts = {
    organization: { name: client.name, industry: client.industry, size: client.size, description: client.description },
    stakeholders: (stakeholders.data ?? []).map((s) => ({
      name: s.name,
      category: s.category,
      type: s.stakeholder_type,
      influence: s.influence_category,
      priority: s.is_priority,
      population: s.population_size,
      normalizedScore: s.normalized_score,
    })),
    sampling: sample.data
      ? {
          confidenceLevel: Number(sample.data.confidence_level),
          marginOfError: Number(sample.data.margin_error),
          baseSampleSize: baseSampleSize({
            confidence_level: Number(sample.data.confidence_level),
            margin_error: Number(sample.data.margin_error),
            population_proportion: Number(sample.data.population_proportion),
          }),
        }
      : null,
    externalMateriality: (materialTopics.data ?? []).map((t) => ({
      topic: t.name,
      category: t.category,
      griCode: t.gri_code,
      averageStakeholderScore: t.average_score,
      responses: t.response_count,
      material: t.is_material,
    })),
    internalImpact: (internalTopics.data ?? []).map((t) => ({
      topic: t.name,
      category: t.category,
      severity: t.severity,
      likelihood: t.likelihood,
      significance: t.significance,
      material: t.is_material,
    })),
    emissions: latest
      ? {
          certificate: latest.certificate_id,
          // Rounded to reporting precision so the draft does not repeat spurious decimals.
          totalTonnesCO2e: Math.round(Number(latest.total_emissions) / 10) / 100,
          breakdownTonnesCO2e: Object.fromEntries(Object.entries(latest.breakdown).map(([k, kg]) => [k, Math.round(Number(kg) / 10) / 100])),
          offsetTonnes: latest.offset_tonnes,
          verification: 'Inventory hash anchored on Hedera Consensus Service; certificate minted as an NFT',
        }
      : null,
  };

  const { data, model } = await provider.generate({
    feature: 'GRI draft',
    system: SYSTEM_PROMPT,
    content: [{ type: 'text', text: `Assessment data:\n${JSON.stringify(facts, null, 2)}` }],
    schema: DraftSchema,
    schemaName: 'gri_draft',
    effort: 'medium',
    maxTokens: 24_000,
  });

  const draftHash = await hashCanonical({ client: clientId, facts, draft: data });
  const hcs = await anchor({ type: 'AI_GRI_DRAFT', client: clientId, draftHash, model, disclosures: data.disclosures.length });
  return one(
    await db
      .from('gri_drafts')
      .insert({ user_id: user.id, client_id: clientId, content: data, model, draft_hash: draftHash, hcs_tx_id: hcs.txId, hcs_sequence: hcs.sequence })
      .select('*')
      .single<GriDraft>(),
    'Save draft',
  );
}
