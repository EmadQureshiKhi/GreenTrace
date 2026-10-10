/**
 * Creates GreenTrace's on-chain infrastructure on Hedera and records the ids in .env.local:
 *   - HCS topic for the audit log (only the treasury can write to it)
 *   - CO2e fungible token (1 token = 1 tonne), with supply and wipe keys for retirement
 *   - Certificate NFT collection
 *   - GreenTraceExchange contract (payments and retirement requests)
 * Re-running skips anything that already exists. Requires HEDERA_OPERATOR_KEY (ECDSA, hex) for an
 * account that holds testnet HBAR. Usage: npm run setup:hedera
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  AccountId,
  Client,
  ContractCreateFlow,
  ContractFunctionParameters,
  Hbar,
  PrivateKey,
  TokenCreateTransaction,
  TokenSupplyType,
  TokenType,
  TopicCreateTransaction,
} from '@hashgraph/sdk';
import { readEnv, writeEnv } from './env-file';

const env = readEnv();
const network = env.HEDERA_NETWORK || 'testnet';
const mirror = `https://${network}.mirrornode.hedera.com`;

async function main() {
  if (!env.HEDERA_OPERATOR_KEY) throw new Error('HEDERA_OPERATOR_KEY is missing from .env.local');
  const key = PrivateKey.fromStringECDSA(env.HEDERA_OPERATOR_KEY);
  const evmAddress = `0x${key.publicKey.toEvmAddress()}`;

  let operatorId = env.HEDERA_OPERATOR_ID;
  if (!operatorId) {
    const res = await fetch(`${mirror}/api/v1/accounts/${evmAddress}`);
    if (!res.ok) {
      throw new Error(`No ${network} account exists for ${evmAddress} yet. Send it testnet HBAR from https://portal.hedera.com/faucet and re-run.`);
    }
    operatorId = ((await res.json()) as { account: string }).account;
    writeEnv({ HEDERA_OPERATOR_ID: operatorId, NEXT_PUBLIC_TREASURY_ACCOUNT_ID: operatorId, NEXT_PUBLIC_HEDERA_NETWORK: network });
    console.log(`Treasury account: ${operatorId} (${evmAddress})`);
  }

  const client = network === 'mainnet' ? Client.forMainnet() : network === 'previewnet' ? Client.forPreviewnet() : Client.forTestnet();
  client.setOperator(AccountId.fromString(operatorId), key);
  client.setDefaultMaxTransactionFee(new Hbar(50));

  const balance = await (await fetch(`${mirror}/api/v1/accounts/${operatorId}`)).json() as { balance: { balance: number } };
  console.log(`Treasury balance: ${(balance.balance.balance / 1e8).toFixed(2)} HBAR`);

  if (!env.NEXT_PUBLIC_HCS_TOPIC_ID) {
    const tx = await new TopicCreateTransaction()
      .setTopicMemo('GreenTrace audit log')
      .setAdminKey(key.publicKey)
      .setSubmitKey(key.publicKey)
      .execute(client);
    const topicId = (await tx.getReceipt(client)).topicId!.toString();
    writeEnv({ NEXT_PUBLIC_HCS_TOPIC_ID: topicId });
    console.log(`Audit topic: ${topicId}`);
  }

  if (!env.NEXT_PUBLIC_CO2E_TOKEN_ID) {
    const tx = await new TokenCreateTransaction()
      .setTokenName('GreenTrace Carbon Credit')
      .setTokenSymbol('GTCO2')
      .setTokenMemo('1 token = 1 tonne CO2e')
      .setDecimals(0)
      .setInitialSupply(100_000)
      .setTreasuryAccountId(operatorId)
      .setSupplyType(TokenSupplyType.Infinite)
      .setAdminKey(key.publicKey)
      .setSupplyKey(key.publicKey)
      .setWipeKey(key.publicKey)
      .execute(client);
    const tokenId = (await tx.getReceipt(client)).tokenId!.toString();
    writeEnv({ NEXT_PUBLIC_CO2E_TOKEN_ID: tokenId });
    console.log(`CO2e token: ${tokenId}`);
  }

  if (!env.NEXT_PUBLIC_CERTIFICATE_TOKEN_ID) {
    const tx = await new TokenCreateTransaction()
      .setTokenName('GreenTrace GHG Certificate')
      .setTokenSymbol('GTCERT')
      .setTokenMemo('Verified greenhouse gas inventory certificates')
      .setTokenType(TokenType.NonFungibleUnique)
      .setDecimals(0)
      .setInitialSupply(0)
      .setTreasuryAccountId(operatorId)
      .setSupplyType(TokenSupplyType.Infinite)
      .setAdminKey(key.publicKey)
      .setSupplyKey(key.publicKey)
      .execute(client);
    const tokenId = (await tx.getReceipt(client)).tokenId!.toString();
    writeEnv({ NEXT_PUBLIC_CERTIFICATE_TOKEN_ID: tokenId });
    console.log(`Certificate NFT collection: ${tokenId}`);
  }

  if (!env.NEXT_PUBLIC_EXCHANGE_CONTRACT_ID) {
    execSync('npx hardhat compile --quiet', { stdio: 'inherit' });
    const artifact = JSON.parse(readFileSync('artifacts/contracts/GreenTraceExchange.sol/GreenTraceExchange.json', 'utf8'));
    // Accounts with an EVM alias (all ECDSA accounts created from an address) only receive value at the
    // alias; their long-zero address does not resolve for value transfers. Prefer the alias.
    const account = (await (await fetch(`${mirror}/api/v1/accounts/${operatorId}`)).json()) as { evm_address: string | null };
    const treasuryAddress = account.evm_address ?? `0x${AccountId.fromString(operatorId).toSolidityAddress()}`;
    console.log(`Exchange forwards payments to ${treasuryAddress}`);
    const tx = await new ContractCreateFlow()
      .setBytecode(artifact.bytecode)
      .setGas(600_000)
      .setConstructorParameters(new ContractFunctionParameters().addAddress(treasuryAddress))
      .setContractMemo('GreenTrace exchange')
      .execute(client);
    const contractId = (await tx.getReceipt(client)).contractId!;
    writeEnv({
      NEXT_PUBLIC_EXCHANGE_CONTRACT_ID: contractId.toString(),
      NEXT_PUBLIC_EXCHANGE_CONTRACT_ADDRESS: `0x${contractId.toSolidityAddress()}`,
    });
    console.log(`Exchange contract: ${contractId} (0x${contractId.toSolidityAddress()})`);
  }

  if (!env.INTERNAL_API_SECRET) writeEnv({ INTERNAL_API_SECRET: randomBytes(32).toString('hex') });

  client.close();
  console.log('Hedera setup complete. Restart the dev server to pick up the new ids.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
