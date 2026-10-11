import 'server-only';
import * as zv3 from 'zod';
import * as z from 'zod/v4';
import { fitAllocation } from '@/lib/ai-math';
import type { CarbonCredit, Certificate, CreditRating } from '@/lib/types';
import type { RequestUser } from '../auth';
import { badRequest, notFound } from '../http';
import { must, supabaseAdmin } from '../supabase-admin';
import { aiProvider } from './provider';
import { consumeAiQuota } from './rate-limit';

export const advisorInput = zv3.object({
  certificateId: zv3.string().uuid(),
  budgetHbar: zv3.number().positive().max(1_000_000).nullable(),
  preferences: zv3.string().max(500).optional(),
});

const AdviceSchema = z.object({
  summary: z.string().describe('Two or three sentences explaining the basket.'),
  allocations: z.array(
    z.object({
      creditId: z.string(),
      quantity: z.number().describe('Whole tonnes'),
      reason: z.string().describe('Why this project is in the basket'),
    }),
  ),
  considerations: z.array(z.string()),
});

const SYSTEM_PROMPT = `You build carbon credit baskets that offset an organization's remaining certified emissions.

Principles:
- Quality first: prefer higher-rated credits; avoid low grades unless the budget forces it, and say so.
- Diversify across project types to spread permanence and delivery risk; include durable removals where available.
- Match the need: the target is the remaining tonnes. Do not exceed available stock or, if given, the budget.
- Offsetting complements reduction; mention it in considerations if the footprint is large.
Use only creditIds from the list provided.`;

export interface OffsetAdvice {
  summary: string;
  considerations: string[];
  tonnesNeeded: number;
  basket: { creditId: string; title: string; quantity: number; priceHbar: number; costHbar: number; grade: string | null; reason: string }[];
  totalTonnes: number;
  totalCostHbar: number;
  coverage: number;
  model: string;
}

export async function adviseOffsets(user: RequestUser, input: zv3.infer<typeof advisorInput>): Promise<OffsetAdvice> {
  const db = supabaseAdmin();
  const certificate = must(
    await db.from('certificates').select('*').eq('id', input.certificateId).eq('user_id', user.id).maybeSingle<Certificate>(),
    'Load certificate',
  );
  if (!certificate) throw notFound('Certificate not found.');

  const tonnesNeeded = Math.max(0, Math.ceil(Number(certificate.total_emissions) / 1000) - certificate.offset_tonnes);
  if (tonnesNeeded === 0) throw badRequest('This certificate is already fully offset.');

  const [{ data: credits }, { data: ratings }] = await Promise.all([
    db.from('carbon_credits').select('*').gt('available', 0),
    db.from('credit_ratings').select('*'),
  ]);
  const listings = (credits as CarbonCredit[]) ?? [];
  if (listings.length === 0) throw badRequest('No credits are available right now.');
  const ratingById = new Map(((ratings as CreditRating[]) ?? []).map((r) => [r.credit_id, r]));

  await consumeAiQuota(user.id, 'offset-advisor');
  const provider = await aiProvider();
  const { data, model } = await provider.generate({
    feature: 'offset advisor',
    system: SYSTEM_PROMPT,
    content: [
      {
        type: 'text',
        text: [
          `Remaining emissions to offset: ${tonnesNeeded} t CO2e (certificate ${certificate.certificate_id}, ${certificate.organization ?? ''})`,
          `Budget: ${input.budgetHbar != null ? `${input.budgetHbar} HBAR` : 'no limit'}`,
          input.preferences ? `Buyer preferences: ${input.preferences}` : '',
          'Available credits (creditId | title | type | location | vintage | price HBAR/t | available t | AI grade):',
          ...listings.map((c) => {
            const r = ratingById.get(c.id);
            return `${c.id} | ${c.title} | ${c.project_type} | ${c.location} | ${c.vintage} | ${c.price_hbar} | ${c.available} | ${r ? `${r.grade} (${r.overall_score})` : 'unrated'}`;
          }),
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
    schema: AdviceSchema,
    schemaName: 'offset_basket',
    effort: 'medium',
  });

  const fitted = fitAllocation(
    data.allocations,
    listings.map((c) => ({ id: c.id, available: c.available, priceHbar: Number(c.price_hbar) })),
    tonnesNeeded,
    input.budgetHbar,
  );
  const reasons = new Map(data.allocations.map((a) => [a.creditId, a.reason]));
  const byId = new Map(listings.map((c) => [c.id, c]));

  return {
    summary: data.summary,
    considerations: data.considerations,
    tonnesNeeded,
    basket: fitted.basket.map((a) => {
      const credit = byId.get(a.creditId)!;
      return {
        creditId: a.creditId,
        title: credit.title,
        quantity: a.quantity,
        priceHbar: Number(credit.price_hbar),
        costHbar: Math.round(a.quantity * Number(credit.price_hbar) * 1e8) / 1e8,
        grade: ratingById.get(a.creditId)?.grade ?? null,
        reason: reasons.get(a.creditId) ?? '',
      };
    }),
    totalTonnes: fitted.totalTonnes,
    totalCostHbar: fitted.totalCostHbar,
    coverage: fitted.coverage,
    model,
  };
}
