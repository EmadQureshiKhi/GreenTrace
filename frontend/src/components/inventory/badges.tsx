import { AlertTriangle, Calculator, FileSpreadsheet, PencilLine, Sparkles } from 'lucide-react';
import type { AiAudit, FindingSeverity, InventorySource } from '@/lib/types';
import { cn } from '@/lib/utils';
import { SOURCE_LABELS } from './inventory-utils';
import { RISK_TONES, SEVERITY_TONES } from './tones';

const pill = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium';

export function SourceBadge({ source, className }: { source: InventorySource; className?: string }) {
  const Icon = source === 'ai_extraction' ? Sparkles : source === 'calculator' ? Calculator : FileSpreadsheet;
  const tone =
    source === 'ai_extraction'
      ? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200'
      : source === 'calculator'
        ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200'
        : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
  return (
    <span className={cn(pill, tone, className)}>
      <Icon className="h-3 w-3" />
      {SOURCE_LABELS[source]}
    </span>
  );
}

/** Green at 85% and above, amber at 70% and above, red below. */
export function ConfidenceBadge({ confidence, className }: { confidence: number | null | undefined; className?: string }) {
  if (confidence === null || confidence === undefined) return <span className="text-xs text-muted-foreground">-</span>;
  const tone =
    confidence >= 0.85
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
      : confidence >= 0.7
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
        : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200';
  return (
    <span className={cn(pill, tone, className)} title="How sure the AI is about the quantity, unit and source">
      {Math.round(confidence * 100)}%
    </span>
  );
}

export function IssueBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(pill, 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200', className)}>
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {children}
    </span>
  );
}

export function EditedBadge({ className }: { className?: string }) {
  return (
    <span className={cn(pill, 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200', className)} title="A person changed a value the AI read">
      <PencilLine className="h-3 w-3" />
      Edited
    </span>
  );
}

export function RiskBadge({ level, className }: { level: AiAudit['risk_level']; className?: string }) {
  return <span className={cn(pill, RISK_TONES[level].badge, className)}>{RISK_TONES[level].label}</span>;
}

export function SeverityBadge({ severity, className }: { severity: FindingSeverity; className?: string }) {
  return <span className={cn(pill, SEVERITY_TONES[severity].badge, className)}>{SEVERITY_TONES[severity].label}</span>;
}
