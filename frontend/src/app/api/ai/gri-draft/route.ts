import * as z from 'zod';
import { draftGri } from '@/server/ai/gri';
import { requireUser } from '@/server/auth';
import { readJson, route } from '@/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const input = z.object({ clientId: z.string().uuid() });

export const POST = route(async (req) => {
  const user = await requireUser(req);
  return { draft: await draftGri(user, input.parse(await readJson(req)).clientId) };
});
