// The exact message a user signs to prove they control the wallet they link. Shared by the browser
// (which asks the wallet to sign it) and the server (which recovers the signer from it).

export const WALLET_LINK_MAX_AGE_MS = 10 * 60 * 1000;

export function walletLinkMessage(userId: string, address: string, issuedAt: string): string {
  return [
    'GreenTrace wallet link',
    '',
    'Sign this message to link this wallet to your GreenTrace account.',
    'It does not send a transaction or cost any HBAR.',
    '',
    `Account: ${userId}`,
    `Wallet: ${address.toLowerCase()}`,
    `Issued: ${issuedAt}`,
  ].join('\n');
}
