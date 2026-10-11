import 'server-only';
import * as zv3 from 'zod';
import * as z from 'zod/v4';
import { quantifyMeasures, trajectory } from '@/lib/ai-math';
import { hashCanonical } from '@/lib/hashing';
import type { ReductionPlan, ReductionPlanContent } from '@/lib/types';
import type { RequestUser } from '../auth';
import { anchor } from '../hedera';
import { badRequest } from '../http';
import { one, supabaseAdmin } from '../supabase-admin';
import { inventoryLines, loadOwnedInventory } from '../services/inventories';
import { aiProvider } from './provider';
import { consumeAiQuota } from './rate-limit';

const PROMPT_VERSION = 'gt-reduce-1.0';

export const reductionInput = zv3.object({
  emissionDataId: zv3.string().uuid(),
  industry: zv3.string().trim().min(2).max(100),
  region: zv3.string().trim().min(2).max(100),
  budget: zv3.enum(['low', 'medium', 'high']),
  targetYear: zv3.number().int().min(new Date().getFullYear() + 1).max(2050),
  notes: zv3.string().max(1000).optional(),
});

const PlanSchema = z.object({
  summary: z.string().describe('Three or four sentences: the strategy and the biggest levers.'),
  measures: z.array(
    z.object({
      title: z.string(),
      description: z.string().describe('What to do, concretely, in two sentences.'),
      targetCategory: z.string().describe('Exactly one of the breakdown keys given in the input'),
      reductionShare: z.number().describe('Fraction (0 to 0.95) of that category\'s emissions this measure removes once fully in place'),
      capex: z.enum(['low', 'medium', 'high']),
      paybackYears: z.number().nullable(),
      difficulty: z.enum(['easy', 'moderate', 'hard']),
      startYear: z.number(),
      rationale: z.string().describe('Why this share is realistic, citing the inventory data'),
    }),
  ),
  caveats: z.array(z.string()),
});

const SYSTEM_PROMPT = `You are a decarbonization advisor. Given an organization's measured Scope 1 and 2 inventory, propose a practical reduction plan.

Rules:
- Only target categories present in the breakdown, using the exact key.
- Prefer high-impact, proven measures first: efficiency, electrification, renewable electricity procurement, fleet transition, refrigerant management, heat recovery.
- reductionShare is the realistic fraction of the targeted category removed once the measure is fully in place. Be conservative; do not stack measures past what is physically possible.
- Respect the budget level: low budget favours operational changes and procurement; high budget allows capital projects.
- Start years run from next year to the target year.
- 4 to 8 measures. No offsets or credits: this plan is about real reductions.
- Do not output tonnes; they are computed from the data.`;

export async function createReductionPlan(user: RequestUser, input: zv3.infer<typeof reductionInput>): Promise<ReductionPlan> {
  const inventory = await loadOwnedInventory(user, input.emissionDataId);
  const breakdown = Object.fromEntries(Object.entries(inventory.breakdown).filter(([, kg]) => Number(kg) > 0)) as Record<string, number>;
  if (Object.keys(breakdown).length === 0) throw badRequest('This inventory has no emissions to reduce.');

  await consumeAiQuota(user.id, 'reduction-plan');
  const provider = await aiProvider();
  const lines = inventoryLines(inventory);
  const currentYear = new Date().getFullYear();

  const { data, model } = await provider.generate({
    feature: 'reduction plan',
    system: SYSTEM_PROMPT,
    content: [
      {
        type: 'text',
        text: [
          `Organization: ${inventory.organization ?? 'unknown'}; industry: ${input.industry}; region: ${input.region}`,
          `Budget: ${input.budget}; target year: ${input.targetYear}; current year: ${currentYear}`,
          input.notes ? `Constraints from the user: ${input.notes}` : '',
          `Total: ${(Number(inventory.total_emissions) / 1000).toFixed(2)} t CO2e for ${inventory.reporting_period_start ?? '?'} to ${inventory.reporting_period_end ?? '?'}`,
          `Breakdown keys and kg CO2e: ${JSON.stringify(breakdown)}`,
          'Activity lines:',
          ...lines.map((l) => `- ${l.scope} - ${l.category}: ${l.fuelType}, ${l.quantity} ${l.unit}, ${l.emissions.toFixed(1)} kg CO2e`),
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
    schema: PlanSchema,
    schemaName: 'reduction_plan',
    effort: 'medium',
  });

  const measures = quantifyMeasures(
    breakdown,
    data.measures.map((m, i) => ({
      ...m,
      id: `m${i + 1}`,
      scope: m.targetCategory.startsWith('Scope 2') ? ('Scope 2' as const) : ('Scope 1' as const),
      startYear: Math.min(input.targetYear, Math.max(currentYear + 1, Math.round(m.startYear))),
    })),
  ).sort((a, b) => b.annualReductionTonnes - a.annualReductionTonnes);

  // Annualize a part-year inventory so the trajectory is in tonnes per year.
  const days =
    inventory.reporting_period_start && inventory.reporting_period_end
      ? (Date.parse(inventory.reporting_period_end) - Date.parse(inventory.reporting_period_start)) / 86_400_000 + 1
      : 365;
  const annualFactor = days > 0 && days < 360 ? 365 / days : 1;
  const annualMeasures = measures.map((m) => ({ ...m, annualReductionTonnes: Math.round(m.annualReductionTonnes * annualFactor * 1000) / 1000 }));
  const baselineTonnes = (Number(inventory.total_emissions) / 1000) * annualFactor;
  const totalAnnualReductionTonnes = annualMeasures.reduce((sum, m) => sum + m.annualReductionTonnes, 0);

  const plan: ReductionPlanContent = {
    summary: data.summary,
    baselineTonnes: Math.round(baselineTonnes * 1000) / 1000,
    targetYear: input.targetYear,
    measures: annualMeasures,
    trajectory: trajectory(baselineTonnes, annualMeasures, currentYear, input.targetYear),
    totalAnnualReductionTonnes: Math.round(totalAnnualReductionTonnes * 1000) / 1000,
    reductionPercent: baselineTonnes > 0 ? Math.round((totalAnnualReductionTonnes / baselineTonnes) * 1000) / 10 : 0,
    caveats: [
      ...(annualFactor !== 1 ? [`The inventory covers ${Math.round(days)} days; figures are annualized.`] : []),
      ...data.caveats,
    ],
  };

  const planHash = await hashCanonical({ inventory: inventory.id, inputs: input, plan });
  const hcs = await anchor({ type: 'AI_REDUCTION_PLAN', inventory: inventory.id, planHash, reductionPercent: plan.reductionPercent, model, prompt: PROMPT_VERSION });

  return one(
    await supabaseAdmin()
      .from('reduction_plans')
      .insert({ user_id: user.id, emission_data_id: inventory.id, inputs: input, plan, model, plan_hash: planHash, hcs_tx_id: hcs.txId, hcs_sequence: hcs.sequence })
      .select('*')
      .single<ReductionPlan>(),
    'Save plan',
  );
}
