import 'server-only';
import * as z from 'zod/v4';
import { gradeFor, overallScore, RATING_WEIGHTS, type RatingDimension } from '@/lib/ai-math';
import { hashCanonical } from '@/lib/hashing';
import type { CarbonCredit, CreditRating } from '@/lib/types';
import type { RequestUser } from '../auth';
import { anchor } from '../hedera';
import { notFound } from '../http';
import { must, one, supabaseAdmin } from '../supabase-admin';
import { aiProvider } from './provider';
import { consumeAiQuota } from './rate-limit';

const PROMPT_VERSION = 'gt-rating-1.0';

const dimension = z.object({
  score: z.number().describe('0 to 100'),
  rationale: z.string().describe('One or two sentences grounded in the project facts'),
});

const RatingSchema = z.object({
  additionality: dimension.describe('Would the reductions have happened anyway? Financial, regulatory and common-practice tests.'),
  permanence: dimension.describe('Risk the stored or avoided carbon is released later; buffer pools; crediting period.'),
  mrv: dimension.describe('Monitoring, reporting and verification quality: methodology, third-party verification, monitoring frequency, remote sensing.'),
  leakage: dimension.describe('Risk emissions just move elsewhere; how leakage is accounted for.'),
  coBenefits: dimension.describe('Verified benefits beyond carbon: biodiversity, community income, health, SDGs.'),
  summary: z.string().describe('Two sentences for a buyer'),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
});

const SYSTEM_PROMPT = `You assess the quality of carbon credit projects for buyers, in the spirit of the ICVCM Core Carbon Principles and independent ratings agencies.

Score each dimension from 0 to 100 using only the project facts provided. Missing information is itself a risk: score it down and say what is missing, do not assume the best case. Be specific and even-handed; a credible rating names real weaknesses. Do not give an overall score or grade; that is computed from your dimension scores.`;

export async function rateCredit(user: RequestUser, creditId: string, refresh = false): Promise<CreditRating> {
  const db = supabaseAdmin();
  if (!refresh) {
    const { data: cached } = await db.from('credit_ratings').select('*').eq('credit_id', creditId).maybeSingle<CreditRating>();
    if (cached) return cached;
  }

  const credit = must(await db.from('carbon_credits').select('*').eq('id', creditId).maybeSingle<CarbonCredit>(), 'Load listing');
  if (!credit) throw notFound('Listing not found.');

  await consumeAiQuota(user.id, 'credit-rating');
  const provider = await aiProvider();
  const { data, model } = await provider.generate({
    feature: 'credit rating',
    system: SYSTEM_PROMPT,
    content: [
      {
        type: 'text',
        text: [
          `Project: ${credit.title}`,
          `Type: ${credit.project_type}; location: ${credit.location}; vintage: ${credit.vintage}`,
          `Methodology: ${credit.methodology ?? 'not stated'}; registry: ${credit.registry ?? 'not stated'}`,
          `Description: ${credit.description}`,
          `Project facts: ${JSON.stringify(credit.project_details)}`,
        ].join('\n'),
      },
    ],
    schema: RatingSchema,
    schemaName: 'credit_rating',
    effort: 'high',
  });

  const dims = Object.keys(RATING_WEIGHTS) as RatingDimension[];
  const scores = Object.fromEntries(dims.map((d) => [d, { score: Math.round(Math.min(100, Math.max(0, data[d].score))), rationale: data[d].rationale }]));
  const overall = overallScore(Object.fromEntries(dims.map((d) => [d, scores[d].score])) as Record<RatingDimension, number>);
  const grade = gradeFor(overall);

  const ratingHash = await hashCanonical({ credit: credit.id, scores, overall, grade, model, prompt: PROMPT_VERSION });
  const hcs = await anchor({ type: 'AI_CREDIT_RATING', credit: credit.id, grade, score: overall, ratingHash, model, prompt: PROMPT_VERSION });

  return one(
    await db
      .from('credit_ratings')
      .upsert(
        {
          credit_id: credit.id,
          grade,
          overall_score: overall,
          scores,
          summary: data.summary,
          strengths: data.strengths,
          risks: data.risks,
          model,
          rating_hash: ratingHash,
          hcs_tx_id: hcs.txId,
          hcs_sequence: hcs.sequence,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'credit_id' },
      )
      .select('*')
      .single<CreditRating>(),
    'Save rating',
  );
}
