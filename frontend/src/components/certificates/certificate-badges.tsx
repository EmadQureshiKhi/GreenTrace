import { Badge } from '@/components/ui/badge';
import type { AiAudit, Certificate, Retirement } from '@/lib/types';
import { cn } from '@/lib/utils';

const tone = {
  emerald: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  sky: 'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  amber: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  red: 'border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  muted: 'border-transparent bg-muted text-muted-foreground',
} as const;

type Tone = keyof typeof tone;

function ToneBadge({ color, children, className }: { color: Tone; children: React.ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap', tone[color], className)}>
      {children}
    </Badge>
  );
}

const STATUS: Record<Certificate['status'], { label: string; color: Tone }> = {
  issued: { label: 'Issued', color: 'sky' },
  partially_offset: { label: 'Partially offset', color: 'amber' },
  offset: { label: 'Offset', color: 'emerald' },
};

export function CertificateStatusBadge({ status, className }: { status: Certificate['status']; className?: string }) {
  const meta = STATUS[status] ?? STATUS.issued;
  return (
    <ToneBadge color={meta.color} className={className}>
      {meta.label}
    </ToneBadge>
  );
}

const RISK: Record<AiAudit['risk_level'], Tone> = { low: 'emerald', medium: 'amber', high: 'red' };

export function RiskBadge({ level }: { level: AiAudit['risk_level'] }) {
  return <ToneBadge color={RISK[level] ?? 'muted'}>{level.charAt(0).toUpperCase() + level.slice(1)} risk</ToneBadge>;
}

export function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <ToneBadge color="muted">Unrated</ToneBadge>;
  const color: Tone = grade.startsWith('A') ? 'emerald' : grade.startsWith('B') && grade !== 'B' ? 'amber' : 'red';
  return <ToneBadge color={color} className="font-mono">{grade}</ToneBadge>;
}

const RETIREMENT: Record<Retirement['status'], { label: string; color: Tone }> = {
  pending: { label: 'Pending', color: 'muted' },
  processing: { label: 'Processing', color: 'sky' },
  completed: { label: 'Retired', color: 'emerald' },
  failed: { label: 'Failed', color: 'red' },
};

export function RetirementStatusBadge({ status }: { status: Retirement['status'] }) {
  const meta = RETIREMENT[status] ?? RETIREMENT.pending;
  return <ToneBadge color={meta.color}>{meta.label}</ToneBadge>;
}
