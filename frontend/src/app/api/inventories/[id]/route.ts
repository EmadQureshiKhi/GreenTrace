import { requireUser } from '@/server/auth';
import { readJson, route } from '@/server/http';
import { deleteInventory, inventoryInput, updateInventory } from '@/server/services/inventories';

export const dynamic = 'force-dynamic';

export const PUT = route<{ params: { id: string } }>(async (req, { params }) => {
  const user = await requireUser(req);
  return { inventory: await updateInventory(user, params.id, inventoryInput.parse(await readJson(req))) };
});

export const DELETE = route<{ params: { id: string } }>(async (req, { params }) => {
  await deleteInventory(await requireUser(req), params.id);
  return { ok: true };
});
