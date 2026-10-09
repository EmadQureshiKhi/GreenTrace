import 'server-only';
import type { Profile } from '@/lib/types';
import { forbidden, unauthorized } from './http';
import { must, supabaseAdmin } from './supabase-admin';

export interface RequestUser {
  id: string;
  email: string | null;
  profile: Profile;
}

/** Resolves the signed-in user from the `Authorization: Bearer <supabase access token>` header. */
export async function requireUser(req: Request): Promise<RequestUser> {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized();

  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) throw unauthorized('Your session has expired. Sign in again.');

  const profile = must(
    await supabaseAdmin().from('profiles').select('*').eq('id', data.user.id).maybeSingle<Profile>(),
    'Load profile',
  );
  if (!profile) throw unauthorized('Your account profile is missing. Sign out and sign in again.');
  return { id: data.user.id, email: data.user.email ?? null, profile };
}

/** Like requireUser, but also requires a linked wallet (needed for on-chain actions). */
export async function requireWalletUser(req: Request): Promise<RequestUser & { wallet: string }> {
  const user = await requireUser(req);
  if (!user.profile.wallet_address) throw forbidden('Link your wallet first (account menu, top right).');
  return { ...user, wallet: user.profile.wallet_address };
}

/** For calls from the optional self-hosted listener (backend-listener/). */
export function requireInternal(req: Request, secret: string): void {
  const header = req.headers.get('authorization') || '';
  if (header !== `Bearer ${secret}`) throw unauthorized('Invalid internal credentials.');
}
