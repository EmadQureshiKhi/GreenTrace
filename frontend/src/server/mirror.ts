import 'server-only';
import { mirrorNodeUrl } from '@/lib/chain-config';

// Read-only access to the Hedera mirror node REST API. The mirror node lags consensus by a few
// seconds, so lookups for something that just happened go through `waitFor`.

async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(`${mirrorNodeUrl}${path}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Mirror node ${path} returned ${res.status}`);
  return (await res.json()) as T;
}

export async function waitFor<T>(load: () => Promise<T | null>, timeoutMs = 30_000, intervalMs = 2_000): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await load();
    if (value) return value;
    if (Date.now() + intervalMs > deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export interface MirrorAccount {
  account: string;
  evm_address: string | null;
  balance: { balance: number };
  max_automatic_token_associations: number;
}

export function getAccount(idOrEvmAddress: string) {
  return get<MirrorAccount>(`/api/v1/accounts/${idOrEvmAddress}`);
}

export async function getTokenBalance(accountId: string, tokenId: string): Promise<number> {
  const data = await get<{ tokens: { token_id: string; balance: number }[] }>(
    `/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`,
  );
  return data?.tokens.find((t) => t.token_id === tokenId)?.balance ?? 0;
}

export async function isTokenAssociated(accountId: string, tokenId: string): Promise<boolean> {
  const data = await get<{ tokens: { token_id: string }[] }>(`/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`);
  return Boolean(data?.tokens.some((t) => t.token_id === tokenId));
}

export interface MirrorContractLog {
  address: string;
  contract_id: string;
  data: string;
  topics: string[];
}

export interface MirrorContractResult {
  contract_id: string;
  from: string;
  to: string;
  hash: string;
  result: string;
  status: string;
  amount: number;
  timestamp: string;
  logs: MirrorContractLog[];
}

export function getContractResult(txHash: string) {
  return get<MirrorContractResult>(`/api/v1/contracts/results/${txHash}`);
}

export interface MirrorTopicMessage {
  consensus_timestamp: string;
  message: string;
  sequence_number: number;
  topic_id: string;
}

export function getTopicMessage(topicId: string, sequence: number) {
  return get<MirrorTopicMessage>(`/api/v1/topics/${topicId}/messages/${sequence}`);
}

export interface MirrorNft {
  account_id: string;
  metadata: string;
  serial_number: number;
  token_id: string;
  deleted: boolean;
}

export function getNft(tokenId: string, serial: number) {
  return get<MirrorNft>(`/api/v1/tokens/${tokenId}/nfts/${serial}`);
}

export interface MirrorContractLogPage {
  logs: (MirrorContractLog & { transaction_hash: string; timestamp: string })[];
  links: { next: string | null };
}

/** Recent logs emitted by a contract, newest first. Used by the reconciler. */
export function getContractLogs(contractId: string, sinceTimestamp?: string) {
  const query = sinceTimestamp ? `&timestamp=gt:${sinceTimestamp}` : '';
  return get<MirrorContractLogPage>(`/api/v1/contracts/${contractId}/results/logs?order=asc&limit=100${query}`);
}

export function decodeBase64(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

export interface MirrorLogEntry {
  transaction_hash: string;
  timestamp: string;
}

/** A contract's event logs after `cursor` (a consensus timestamp), oldest first, at most `pages` pages. */
export async function getContractLogsSince(contractId: string, cursor: string, pages = 5): Promise<MirrorLogEntry[]> {
  const logs: MirrorLogEntry[] = [];
  let path: string | null = `/api/v1/contracts/${contractId}/results/logs?order=asc&limit=100&timestamp=gt:${cursor}`;
  for (let page = 0; path && page < pages; page++) {
    const data: { logs: MirrorLogEntry[]; links: { next: string | null } } | null = await get(path);
    if (!data) break;
    logs.push(...data.logs);
    path = data.links.next;
  }
  return logs;
}
