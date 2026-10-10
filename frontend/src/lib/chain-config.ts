// Public on-chain identifiers. Safe for the browser: these are addresses, not secrets.
// They are written to .env.local by `npm run setup:hedera`.

export type HederaNetwork = 'testnet' | 'mainnet' | 'previewnet';

export const chainConfig = {
  network: (process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet') as HederaNetwork,
  treasuryAccountId: process.env.NEXT_PUBLIC_TREASURY_ACCOUNT_ID || '',
  co2eTokenId: process.env.NEXT_PUBLIC_CO2E_TOKEN_ID || '',
  certificateTokenId: process.env.NEXT_PUBLIC_CERTIFICATE_TOKEN_ID || '',
  topicId: process.env.NEXT_PUBLIC_HCS_TOPIC_ID || '',
  exchangeContractId: process.env.NEXT_PUBLIC_EXCHANGE_CONTRACT_ID || '',
  exchangeContractAddress: (process.env.NEXT_PUBLIC_EXCHANGE_CONTRACT_ADDRESS || '').toLowerCase(),
};

const EVM_CHAINS: Record<HederaNetwork, { chainId: number; name: string; rpcUrl: string }> = {
  testnet: { chainId: 296, name: 'Hedera Testnet', rpcUrl: 'https://testnet.hashio.io/api' },
  mainnet: { chainId: 295, name: 'Hedera Mainnet', rpcUrl: 'https://mainnet.hashio.io/api' },
  previewnet: { chainId: 297, name: 'Hedera Previewnet', rpcUrl: 'https://previewnet.hashio.io/api' },
};

export const evmChain = EVM_CHAINS[chainConfig.network];

export const mirrorNodeUrl = `https://${chainConfig.network}.mirrornode.hedera.com`;

export function hashscanUrl(kind: 'transaction' | 'account' | 'token' | 'topic' | 'contract', id: string): string {
  return `https://hashscan.io/${chainConfig.network}/${kind}/${encodeURIComponent(id)}`;
}

/**
 * A link to one Hedera Consensus Service message. HashScan has no page per topic sequence number, only
 * per transaction, so this goes through the app's /hcs route, which looks the message up on the mirror
 * node and redirects to its submit transaction (see hashscanTopicMessageTarget).
 */
export function hashscanTopicMessageUrl(topicId: string, sequence: number | string): string {
  return `/hcs/${encodeURIComponent(topicId)}/${encodeURIComponent(String(sequence))}`;
}

const ENTITY_ID = /^\d+\.\d+\.\d+$/;
const SEQUENCE = /^[1-9]\d{0,15}$/;
const CONSENSUS_TIMESTAMP = /^\d{1,12}\.\d{1,9}$/;

/** Validates a topic message reference from a URL; null when it is not one. */
export function parseTopicMessage(topicId: string, sequence: string): { topicId: string; sequence: number } | null {
  if (!ENTITY_ID.test(topicId) || !SEQUENCE.test(sequence)) return null;
  return { topicId, sequence: Number(sequence) };
}

/** Where a topic message link lands: its transaction (by consensus timestamp), else the topic itself. */
export function hashscanTopicMessageTarget(topicId: string, consensusTimestamp: string | null): string {
  return consensusTimestamp && CONSENSUS_TIMESTAMP.test(consensusTimestamp)
    ? hashscanUrl('transaction', consensusTimestamp)
    : hashscanUrl('topic', topicId);
}

export function hashscanNftUrl(tokenId: string, serial: number | string): string {
  return `https://hashscan.io/${chainConfig.network}/token/${tokenId}/${serial}`;
}

/** 1 HBAR = 100,000,000 tinybar. The EVM relay denominates value in weibar (tinybar x 10^10). */
export const TINYBAR_PER_HBAR = 100_000_000n;
export const WEIBAR_PER_TINYBAR = 10_000_000_000n;
