import { CheckCircle2, Clock, ShieldCheck, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { VerificationResult } from '@/hooks/use-api';
import { cn } from '@/lib/utils';

type Check = VerificationResult['checks'][number];

const ICONS: Record<Check['status'], { icon: typeof CheckCircle2; className: string; label: string }> = {
  pass: { icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400', label: 'Passed' },
  fail: { icon: XCircle, className: 'text-red-600 dark:text-red-400', label: 'Failed' },
  pending: { icon: Clock, className: 'text-amber-600 dark:text-amber-400', label: 'Pending' },
};

export function VerificationPanel({ checks }: { checks: Check[] }) {
  const passed = checks.filter((c) => c.status === 'pass').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" /> Independent verification
          </CardTitle>
          <span className="text-sm text-muted-foreground tabular-nums">
            {passed} of {checks.length} checks passed
          </span>
        </div>
        <CardDescription>
          Every time this page loads, GreenTrace recomputes the inventory hash and compares it with the Hedera consensus record, the certificate
          NFT on chain and the content-addressed metadata.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border">
          {checks.map((check) => {
            const meta = ICONS[check.status];
            const Icon = meta.icon;
            return (
              <li key={check.id} className="flex gap-3 p-3 sm:p-4">
                <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', meta.className)} aria-label={meta.label} />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">{check.label}</p>
                  <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{check.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
