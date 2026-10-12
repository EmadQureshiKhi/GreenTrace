import 'server-only';
import { chainConfig } from '@/lib/chain-config';
import { exchangeInterface } from '@/lib/exchange';
import { badRequest } from '../http';
import { getContractResult, waitFor, type MirrorContractLog, type MirrorContractResult } from '../mirror';

export type ExchangeEvent =
  | { kind: 'purchase'; orderRef: string; buyer: string; amountPaidTinybar: bigint }
  | { kind: 'retirement'; retiree: string; amount: bigint; certificateId: string };

function isExchangeLog(log: MirrorContractLog): boolean {
  const address = log.address?.toLowerCase();
  return log.contract_id === chainConfig.exchangeContractId || (Boolean(address) && address === chainConfig.exchangeContractAddress);
}

export function decodeExchangeLog(log: MirrorContractLog): ExchangeEvent | null {
  if (!isExchangeLog(log)) return null;
  const parsed = exchangeInterface.parseLog({ topics: log.topics, data: log.data });
  if (!parsed) return null;
  if (parsed.name === 'CreditsPurchased') {
    return {
      kind: 'purchase',
      orderRef: String(parsed.args.orderRef).toLowerCase(),
      buyer: String(parsed.args.buyer).toLowerCase(),
      // Inside the Hedera EVM, msg.value is denominated in tinybar.
      amountPaidTinybar: BigInt(parsed.args.amountPaid),
    };
  }
  if (parsed.name === 'RetirementRequested') {
    return {
      kind: 'retirement',
      retiree: String(parsed.args.retiree).toLowerCase(),
      amount: BigInt(parsed.args.amount),
      certificateId: String(parsed.args.certificateId),
    };
  }
  return null;
}

/** Waits for a transaction to be indexed, checks it succeeded, and returns its exchange events. */
export async function loadExchangeTransaction(txHash: string): Promise<{ result: MirrorContractResult; events: ExchangeEvent[] }> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw badRequest('Not a transaction hash.');
  const result = await waitFor(() => getContractResult(txHash));
  if (!result) throw badRequest('The transaction is not on the network yet. Try again in a few seconds.');
  if (result.result !== 'SUCCESS') throw badRequest(`The transaction failed on chain (${result.result}).`);
  const events = result.logs.map(decodeExchangeLog).filter((e): e is ExchangeEvent => e !== null);
  return { result, events };
}
