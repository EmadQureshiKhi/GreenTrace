import 'server-only';
import {
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  TokenId,
  TokenMintTransaction,
  TokenWipeTransaction,
  TopicId,
  TopicMessageSubmitTransaction,
  TransferTransaction,
} from '@hashgraph/sdk';
import { chainConfig } from '@/lib/chain-config';
import { canonicalJson } from '@/lib/hashing';
import type { HcsAnchor } from '@/lib/types';
import { ConfigError, serverEnv } from './env';

// All transactions that need the treasury key happen here, on the server. The key never reaches a
// browser bundle (this module imports 'server-only', so importing it from client code fails the build).

let client: Client | null = null;
let operatorKey: PrivateKey | null = null;

function operator(): { client: Client; key: PrivateKey } {
  if (!client || !operatorKey) {
    operatorKey = PrivateKey.fromStringECDSA(serverEnv.hederaOperatorKey());
    const network = chainConfig.network;
    client = network === 'mainnet' ? Client.forMainnet() : network === 'previewnet' ? Client.forPreviewnet() : Client.forTestnet();
    client.setOperator(AccountId.fromString(serverEnv.hederaOperatorId()), operatorKey);
  }
  return { client, key: operatorKey };
}

function requireId(value: string, name: string): string {
  if (!value) throw new ConfigError(`${name} is not configured. Run \`npm run setup:hedera\`.`);
  return value;
}

/** Appends a JSON message to the GreenTrace audit topic. Messages are canonical JSON. */
export async function anchor(message: Record<string, unknown>): Promise<HcsAnchor> {
  const { client } = operator();
  const topicId = requireId(chainConfig.topicId, 'NEXT_PUBLIC_HCS_TOPIC_ID');
  const response = await new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(topicId))
    .setMessage(canonicalJson({ v: 1, app: 'greentrace', ...message }))
    .execute(client);
  const receipt = await response.getReceipt(client);
  return {
    txId: response.transactionId.toString(),
    sequence: Number(receipt.topicSequenceNumber?.toString() ?? 0),
  };
}

/** Mints one certificate NFT whose metadata is the URI of its JSON metadata (max 100 bytes). */
export async function mintCertificateNft(metadataUri: string): Promise<{ serial: number; txId: string }> {
  const { client } = operator();
  const tokenId = requireId(chainConfig.certificateTokenId, 'NEXT_PUBLIC_CERTIFICATE_TOKEN_ID');
  const metadata = Buffer.from(metadataUri, 'utf8');
  if (metadata.length > 100) throw new Error('NFT metadata URI exceeds 100 bytes');
  const response = await new TokenMintTransaction().setTokenId(TokenId.fromString(tokenId)).setMetadata([metadata]).execute(client);
  const receipt = await response.getReceipt(client);
  const serial = receipt.serials[0];
  if (!serial) throw new Error('Mint receipt has no serial number');
  return { serial: Number(serial.toString()), txId: response.transactionId.toString() };
}

/** Sends CO2e credits from the treasury to a buyer. */
export async function deliverCredits(toAccountId: string, amount: number): Promise<string> {
  const { client } = operator();
  const tokenId = TokenId.fromString(requireId(chainConfig.co2eTokenId, 'NEXT_PUBLIC_CO2E_TOKEN_ID'));
  const response = await new TransferTransaction()
    .addTokenTransfer(tokenId, AccountId.fromString(serverEnv.hederaOperatorId()), -amount)
    .addTokenTransfer(tokenId, AccountId.fromString(toAccountId), amount)
    .setTransactionMemo('GreenTrace credit delivery')
    .execute(client);
  await response.getReceipt(client);
  return response.transactionId.toString();
}

/** Retires credits: removes them from the holder's account and from total supply. */
export async function wipeCredits(fromAccountId: string, amount: number): Promise<string> {
  const { client } = operator();
  const tokenId = TokenId.fromString(requireId(chainConfig.co2eTokenId, 'NEXT_PUBLIC_CO2E_TOKEN_ID'));
  const response = await new TokenWipeTransaction()
    .setTokenId(tokenId)
    .setAccountId(AccountId.fromString(fromAccountId))
    .setAmount(amount)
    .setTransactionMemo('GreenTrace retirement')
    .execute(client);
  await response.getReceipt(client);
  return response.transactionId.toString();
}

/** Sends testnet HBAR from the treasury to an EVM address (creates the Hedera account if it has none yet). */
export async function sendTestHbar(evmAddress: string, hbar: number): Promise<string> {
  if (chainConfig.network !== 'testnet') throw new Error('Test HBAR is only available on testnet.');
  const { client } = operator();
  const response = await new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(serverEnv.hederaOperatorId()), new Hbar(-hbar))
    .addHbarTransfer(AccountId.fromEvmAddress(0, 0, evmAddress), new Hbar(hbar))
    .setTransactionMemo('GreenTrace testnet HBAR for trying the marketplace')
    .execute(client);
  await response.getReceipt(client);
  return response.transactionId.toString();
}
