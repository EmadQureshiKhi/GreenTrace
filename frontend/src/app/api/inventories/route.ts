import { requireUser } from '@/server/auth';
import { readJson, route } from '@/server/http';
import { createInventory, inventoryInput } from '@/server/services/inventories';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const user = await requireUser(req);
  return { inventory: await createInventory(user, inventoryInput.parse(await readJson(req))) };
});
