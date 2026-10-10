import { Interface } from 'ethers';

// ABI of contracts/GreenTraceExchange.sol, shared by the browser (to send) and the server (to verify).
export const exchangeAbi = [
  'function purchase(bytes32 orderRef) payable',
  'function requestRetirement(uint256 amount, string certificateId)',
  'event CreditsPurchased(bytes32 indexed orderRef, address indexed buyer, uint256 amountPaid)',
  'event RetirementRequested(address indexed retiree, uint256 amount, string certificateId)',
] as const;

export const exchangeInterface = new Interface(exchangeAbi);
