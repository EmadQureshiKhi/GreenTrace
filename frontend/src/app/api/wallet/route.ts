import { requireUser } from '@/server/auth';
import { readJson, route } from '@/server/http';
import { linkWallet, linkWalletInput, unlinkWallet, walletStatus } from '@/server/services/wallet';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => ({ wallet: await walletStatus(await requireUser(req)) }));

export const POST = route(async (req) => {
  const user = await requireUser(req);
  return { profile: await linkWallet(user, linkWalletInput.parse(await readJson(req))) };
});

export const DELETE = route(async (req) => ({ profile: await unlinkWallet(await requireUser(req)) }));
