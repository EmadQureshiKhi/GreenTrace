import { requireUser } from '@/server/auth';
import { readJson, route } from '@/server/http';
import { anchorSemaAction, semaAnchorInput } from '@/server/services/sema';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const user = await requireUser(req);
  return anchorSemaAction(user, semaAnchorInput.parse(await readJson(req)));
});
