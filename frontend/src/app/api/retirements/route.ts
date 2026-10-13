import { requireUser } from '@/server/auth';
import { readJson, route } from '@/server/http';
import { processRetirement, retirementInput } from '@/server/services/retirements';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { txHash } = retirementInput.parse(await readJson(req));
  return { retirement: await processRetirement(txHash, user.id) };
});
