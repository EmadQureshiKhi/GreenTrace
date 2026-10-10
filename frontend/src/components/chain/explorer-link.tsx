import { ExternalLink } from 'lucide-react';
import { hashscanUrl, hashscanNftUrl, hashscanTopicMessageUrl } from '@/lib/chain-config';
import { shortHash } from '@/lib/format';
import { cn } from '@/lib/utils';

type Target =
  | { kind: 'transaction' | 'account' | 'token' | 'topic' | 'contract'; id: string }
  | { kind: 'topic-message'; topicId: string; sequence: number }
  | { kind: 'nft'; tokenId: string; serial: number };

function href(target: Target): string {
  if (target.kind === 'topic-message') return hashscanTopicMessageUrl(target.topicId, target.sequence);
  if (target.kind === 'nft') return hashscanNftUrl(target.tokenId, target.serial);
  return hashscanUrl(target.kind, target.id);
}

function defaultLabel(target: Target): string {
  if (target.kind === 'topic-message') return `${target.topicId} #${target.sequence}`;
  if (target.kind === 'nft') return `${target.tokenId} #${target.serial}`;
  return target.id.startsWith('0x') ? shortHash(target.id, 8, 6) : target.id;
}

/** Link to the transaction, account, token or message on HashScan. */
export function ExplorerLink({ label, className, ...target }: Target & { label?: string; className?: string }) {
  return (
    <a
      href={href(target as Target)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline break-all', className)}
    >
      {label ?? defaultLabel(target as Target)}
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  );
}
