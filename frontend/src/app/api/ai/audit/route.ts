import * as z from 'zod';
import { auditInventory } from '@/server/ai/audit';
import { requireUser } from '@/server/auth';
import { readJson, route } from '@/server/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const input = z.object({ emissionDataId: z.string().uuid() });

export const POST = route(async (req) => {
  const user = await requireUser(req);
  return { audit: await auditInventory(user, input.parse(await readJson(req)).emissionDataId) };
});
