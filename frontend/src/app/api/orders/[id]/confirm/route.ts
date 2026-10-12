import { requireUser } from '@/server/auth';
import { readJson, route } from '@/server/http';
import { confirmOrderInput, fulfilPurchase } from '@/server/services/orders';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export const POST = route<{ params: { id: string } }>(async (req, { params }) => {
  const user = await requireUser(req);
  const { txHash } = confirmOrderInput.parse(await readJson(req));
  const order = await fulfilPurchase(txHash, user.id);
  if (order.id !== params.id) throw new Error('The payment is for a different order.');
  return { order };
});
