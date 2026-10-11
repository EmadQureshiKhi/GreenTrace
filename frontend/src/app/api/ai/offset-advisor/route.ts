import { adviseOffsets, advisorInput } from '@/server/ai/advisor';
import { requireUser } from '@/server/auth';
import { readJson, route } from '@/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const POST = route(async (req) => {
  const user = await requireUser(req);
  return { advice: await adviseOffsets(user, advisorInput.parse(await readJson(req))) };
});
