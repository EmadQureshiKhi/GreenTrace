'use client';

import { BrowserProvider, type Eip1193Provider, toQuantity } from 'ethers';
import { chainConfig, evmChain, WEIBAR_PER_TINYBAR } from './chain-config';
import { exchangeInterface } from './exchange';

// Browser wallet access (MetaMask or any EIP-1193 wallet) on the Hedera EVM.

declare global {
  interface Window {
    ethereum?: Eip1193Provider & { isMetaMask?: boolean };
  }
}

export class WalletError extends Error {}

export function hasWallet(): boolean {
  return typeof window !== 'undefined' && Boolean(window.ethereum);
}

function injected(): Eip1193Provider {
  if (!hasWallet()) throw new WalletError('No browser wallet found. Install MetaMask to continue.');
  return window.ethereum!;
}

function rejected(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return code === 4001 || code === 'ACTION_REJECTED';
}

/** Switches the wallet to the configured Hedera network, adding it first if the wallet doesn't know it. */
export async function ensureHederaNetwork(): Promise<void> {
  const provider = injected();
  const chainId = toQuantity(evmChain.chainId);
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
  } catch (error) {
    if ((error as { code?: number })?.code !== 4902) {
      if (rejected(error)) throw new WalletError(`Switch your wallet to ${evmChain.name} to continue.`);
      throw error;
    }
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId,
          chainName: evmChain.name,
          nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
          rpcUrls: [evmChain.rpcUrl],
          blockExplorerUrls: [`https://hashscan.io/${chainConfig.network}`],
        },
      ],
    });
  }
}

/** Asks the wallet for an account and returns its address (lowercase). */
export async function connectWallet(): Promise<string> {
  try {
    const accounts = (await injected().request({ method: 'eth_requestAccounts' })) as string[];
    if (!accounts?.length) throw new WalletError('The wallet returned no accounts.');
    return accounts[0].toLowerCase();
  } catch (error) {
    if (rejected(error)) throw new WalletError('Wallet connection was cancelled.');
    throw error;
  }
}

async function signerFor(expectedAddress: string) {
  await ensureHederaNetwork();
  const signer = await new BrowserProvider(injected()).getSigner();
  const address = (await signer.getAddress()).toLowerCase();
  if (address !== expectedAddress.toLowerCase()) {
    throw new WalletError(`Your wallet is on ${address.slice(0, 8)}..., but the linked wallet is ${expectedAddress.slice(0, 8)}.... Switch accounts in your wallet.`);
  }
  return signer;
}

export async function signMessage(address: string, message: string): Promise<string> {
  try {
    const provider = injected();
    return (await provider.request({ method: 'personal_sign', params: [message, address] })) as string;
  } catch (error) {
    if (rejected(error)) throw new WalletError('Signature request was cancelled.');
    throw error;
  }
}

// Hedera charges for at least 80% of the gas limit, so limits are sized per call rather than generous.
export interface SendOptions {
  /** Called once the wallet has signed and broadcast the transaction, before it is mined. */
  onSubmitted?: (hash: string) => void;
}

async function send(
  expectedAddress: string,
  data: string,
  gasLimit: number,
  valueTinybar = 0n,
  to = chainConfig.exchangeContractAddress,
  options: SendOptions = {},
): Promise<string> {
  if (!to) throw new WalletError('The exchange contract is not configured.');
  const signer = await signerFor(expectedAddress);
  try {
    const tx = await signer.sendTransaction({ to, data, value: valueTinybar * WEIBAR_PER_TINYBAR, gasLimit });
    options.onSubmitted?.(tx.hash);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new WalletError('The transaction failed on chain.');
    return receipt.hash;
  } catch (error) {
    if (rejected(error)) throw new WalletError('The transaction was cancelled in your wallet.');
    throw error;
  }
}

/** Pays for an order through the exchange contract. Returns the transaction hash. */
export function payForOrder(address: string, orderRef: string, totalTinybar: bigint, options?: SendOptions): Promise<string> {
  return send(address, exchangeInterface.encodeFunctionData('purchase', [orderRef]), 90_000, totalTinybar, undefined, options);
}

/** Records a retirement request on chain. Returns the transaction hash. */
export function requestRetirement(address: string, tonnes: number, certificateId: string, options?: SendOptions): Promise<string> {
  return send(address, exchangeInterface.encodeFunctionData('requestRetirement', [tonnes, certificateId]), 45_000, 0n, undefined, options);
}

/** Associates the CO2e token with the wallet's account (needed only if auto-association is off). */
export function associateCo2eToken(address: string): Promise<string> {
  const tokenAddress = `0x${tokenIdToSolidity(chainConfig.co2eTokenId)}`;
  return send(address, '0x0a754de6', 1_000_000, 0n, tokenAddress);
}

function tokenIdToSolidity(id: string): string {
  const num = BigInt(id.split('.').pop() || '0');
  return num.toString(16).padStart(40, '0');
}
