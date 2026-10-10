import 'server-only';
import { getAddress, verifyMessage } from 'ethers';
import * as z from 'zod';
import { chainConfig } from '@/lib/chain-config';
import type { Profile } from '@/lib/types';
import { WALLET_LINK_MAX_AGE_MS, walletLinkMessage } from '@/lib/wallet-message';
import type { RequestUser } from '../auth';
import { serverEnv } from '../env';
import { anchor, sendTestHbar } from '../hedera';
import { badRequest, conflict } from '../http';
import { getAccount, getTokenBalance, isTokenAssociated, waitFor } from '../mirror';
import { one, supabaseAdmin } from '../supabase-admin';

export const linkWalletInput = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Not an EVM address'),
  issuedAt: z.string().datetime(),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, 'Not a signature'),
});

export async function linkWallet(user: RequestUser, input: z.infer<typeof linkWalletInput>): Promise<Profile> {
  const age = Date.now() - Date.parse(input.issuedAt);
  if (age < -60_000 || age > WALLET_LINK_MAX_AGE_MS) throw badRequest('The signed message has expired. Try again.');

  const address = getAddress(input.address).toLowerCase();
  const signer = verifyMessage(walletLinkMessage(user.id, address, input.issuedAt), input.signature).toLowerCase();
  if (signer !== address) throw badRequest('The signature does not match this wallet.');

  const { data: owner } = await supabaseAdmin().from('profiles').select('id').eq('wallet_address', address).maybeSingle();
  if (owner && owner.id !== user.id) throw conflict('This wallet is already linked to another GreenTrace account.');

  const account = await getAccount(address);
  return one(
    await supabaseAdmin()
      .from('profiles')
      .update({ wallet_address: address, hedera_account_id: account?.account ?? null })
      .eq('id', user.id)
      .select('*')
      .single<Profile>(),
    'Link wallet',
  );
}

export async function unlinkWallet(user: RequestUser): Promise<Profile> {
  return one(
    await supabaseAdmin()
      .from('profiles')
      .update({ wallet_address: null, hedera_account_id: null })
      .eq('id', user.id)
      .select('*')
      .single<Profile>(),
    'Unlink wallet',
  );
}

export interface WalletStatus {
  address: string;
  accountId: string | null;
  hbar: number;
  co2e: number;
  /** True when the account can receive CO2e (associated, or has free auto-association slots). */
  canReceiveCo2e: boolean;
}

/** Live wallet state from the mirror node. Also backfills the Hedera account id once it exists. */
export async function walletStatus(user: RequestUser): Promise<WalletStatus | null> {
  const address = user.profile.wallet_address;
  if (!address) return null;

  const account = await getAccount(address);
  if (!account) return { address, accountId: null, hbar: 0, co2e: 0, canReceiveCo2e: false };

  if (account.account !== user.profile.hedera_account_id) {
    await supabaseAdmin().from('profiles').update({ hedera_account_id: account.account }).eq('id', user.id);
  }

  const tokenId = chainConfig.co2eTokenId;
  const associated = tokenId ? await isTokenAssociated(account.account, tokenId) : false;
  return {
    address,
    accountId: account.account,
    hbar: account.balance.balance / 1e8,
    co2e: associated ? await getTokenBalance(account.account, tokenId) : 0,
    canReceiveCo2e: associated || account.max_automatic_token_associations !== 0,
  };
}

/** Resolves (and caches on the profile) the Hedera account behind a linked EVM wallet. */
export async function resolveAccountId(evmAddress: string): Promise<string | null> {
  const account = await getAccount(evmAddress.toLowerCase());
  return account?.account ?? null;
}

/** True when two EVM addresses belong to the same Hedera account (alias and long-zero forms differ). */
export async function sameAccount(a: string, b: string): Promise<boolean> {
  if (a.toLowerCase() === b.toLowerCase()) return true;
  const [x, y] = await Promise.all([getAccount(a.toLowerCase()), getAccount(b.toLowerCase())]);
  return Boolean(x && y && x.account === y.account);
}

export const TEST_HBAR_GRANT = 25;
const TREASURY_RESERVE_HBAR = 100;

/**
 * One-time testnet HBAR grant for a linked wallet, so a judge or tester with a fresh MetaMask can buy and
 * retire credits without the public faucet. Claimed atomically, so double clicks cannot grant twice.
 */
export async function grantTestHbar(user: RequestUser): Promise<{ txId: string; hbar: number; profile: Profile }> {
  if (chainConfig.network !== 'testnet') throw badRequest('Test HBAR is only available on testnet.');
  const wallet = user.profile.wallet_address;
  if (!wallet) throw badRequest('Link a wallet first.');
  if (user.profile.test_hbar_granted_at) throw conflict('This account already received its test HBAR.');

  const treasury = await getAccount(serverEnv.hederaOperatorId());
  if (!treasury || treasury.balance.balance / 1e8 < TREASURY_RESERVE_HBAR + TEST_HBAR_GRANT) {
    throw conflict('The test HBAR pool is empty right now. Use https://portal.hedera.com/faucet instead.');
  }

  const db = supabaseAdmin();
  const { data: claimed } = await db
    .from('profiles')
    .update({ test_hbar_granted_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('test_hbar_granted_at', null)
    .select('id')
    .maybeSingle();
  if (!claimed) throw conflict('This account already received its test HBAR.');

  try {
    const txId = await sendTestHbar(wallet, TEST_HBAR_GRANT);
    await anchor({ type: 'TEST_HBAR_GRANT', wallet, hbar: TEST_HBAR_GRANT, tx: txId }).catch(() => undefined);
    const account = await waitFor(() => getAccount(wallet), 20_000);
    const profile = one(
      await db.from('profiles').update({ hedera_account_id: account?.account ?? user.profile.hedera_account_id }).eq('id', user.id).select('*').single<Profile>(),
      'Update profile',
    );
    return { txId, hbar: TEST_HBAR_GRANT, profile };
  } catch (error) {
    await db.from('profiles').update({ test_hbar_granted_at: null }).eq('id', user.id);
    throw error;
  }
}
