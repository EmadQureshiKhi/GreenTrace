import { createReductionPlan, reductionInput } from '@/server/ai/reduction';
import { requireUser } from '@/server/auth';
import { readJson, route } from '@/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const POST = route(async (req) => {
  const user = await requireUser(req);
  return { plan: await createReductionPlan(user, reductionInput.parse(await readJson(req))) };
});
