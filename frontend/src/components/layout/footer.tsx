import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { chainConfig, hashscanUrl } from '@/lib/chain-config';
import { Logo } from './logo';

export function Footer() {
  return (
    <footer className="mt-16 border-t bg-background/60">
      <div className="container mx-auto grid gap-8 px-4 py-10 md:grid-cols-3">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted-foreground">
            Verifiable carbon accounting. AI reads and audits your activity data, every result is anchored on Hedera, and credits are bought and retired on chain.
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="font-semibold">IEEE ClimateChain Global Hackathon 2026</h3>
          <p className="text-muted-foreground">
            Built for Track 1: Carbon Markets &amp; Emissions Transparency, organized by the IEEE Blockchain Türkiye Group with the IEEE Blockchain Technical Committee
            and IEEE chapters in support of UN COP 31.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <a href="https://ieee-climatechain-hack.devpost.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Devpost <ExternalLink className="h-3 w-3" />
            </a>
            <a href="https://cmte.ieee.org/turkiye-blockchain/hackatlon/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              IEEE Blockchain Türkiye <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <h3 className="font-semibold">On-chain transparency</h3>
          <ul className="space-y-1 text-muted-foreground">
            {chainConfig.topicId && (
              <li>
                Audit log: <a className="text-primary hover:underline" href={hashscanUrl('topic', chainConfig.topicId)} target="_blank" rel="noopener noreferrer">{chainConfig.topicId}</a>
              </li>
            )}
            {chainConfig.co2eTokenId && (
              <li>
                CO2e credit token: <a className="text-primary hover:underline" href={hashscanUrl('token', chainConfig.co2eTokenId)} target="_blank" rel="noopener noreferrer">{chainConfig.co2eTokenId}</a>
              </li>
            )}
            {chainConfig.certificateTokenId && (
              <li>
                Certificate NFTs: <a className="text-primary hover:underline" href={hashscanUrl('token', chainConfig.certificateTokenId)} target="_blank" rel="noopener noreferrer">{chainConfig.certificateTokenId}</a>
              </li>
            )}
            {chainConfig.exchangeContractId && (
              <li>
                Exchange contract: <a className="text-primary hover:underline" href={hashscanUrl('contract', chainConfig.exchangeContractId)} target="_blank" rel="noopener noreferrer">{chainConfig.exchangeContractId}</a>
              </li>
            )}
            {!chainConfig.topicId && <li>Not yet deployed.</li>}
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="container mx-auto flex flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Carbon accounting you can verify, not just trust. Every tonne measured, certified and retired in the open on Hedera.</p>
          <nav className="flex gap-4" aria-label="Legal">
            <Link href="/privacy" className="hover:text-foreground hover:underline">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground hover:underline">Terms</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
