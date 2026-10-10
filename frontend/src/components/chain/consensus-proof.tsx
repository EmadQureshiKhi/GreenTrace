import { ShieldCheck } from 'lucide-react';
import { chainConfig } from '@/lib/chain-config';
import { cn } from '@/lib/utils';
import { ExplorerLink } from './explorer-link';

/** "Anchored on Hedera" chip linking to the consensus-log message that records an action. */
export function ConsensusProof({ sequence, label = 'Anchored on Hedera', className }: { sequence: number | null | undefined; label?: string; className?: string }) {
  if (!sequence || !chainConfig.topicId) return null;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200', className)}>
      <ShieldCheck className="h-3.5 w-3.5" />
      <span>{label}</span>
      <ExplorerLink kind="topic-message" topicId={chainConfig.topicId} sequence={sequence} label={`message #${sequence}`} />
    </span>
  );
}
