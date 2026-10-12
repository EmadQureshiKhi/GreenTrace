import { requireWalletUser } from '@/server/auth';
import { readJson, route } from '@/server/http';
import { createOrder, createOrderInput } from '@/server/services/orders';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const user = await requireWalletUser(req);
  return { order: await createOrder(user, createOrderInput.parse(await readJson(req))) };
});
