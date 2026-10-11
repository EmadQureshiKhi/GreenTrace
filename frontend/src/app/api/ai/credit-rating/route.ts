import * as z from 'zod';
import { rateCredit } from '@/server/ai/rating';
import { requireUser } from '@/server/auth';
import { readJson, route } from '@/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const input = z.object({ creditId: z.string().uuid(), refresh: z.boolean().optional() });

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { creditId, refresh } = input.parse(await readJson(req));
  return { rating: await rateCredit(user, creditId, refresh) };
});
