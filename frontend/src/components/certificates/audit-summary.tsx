import { ClipboardCheck } from 'lucide-react';
import { AiLabel } from '@/components/ai/ai-label';
import { ConsensusProof } from '@/components/chain/consensus-proof';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AiAudit } from '@/lib/types';
import { RiskBadge } from './certificate-badges';
import { formatDate } from './certificate-utils';

export function AuditSummary({ audit }: { audit: AiAudit }) {
  const findings = audit.findings?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="h-5 w-5 text-primary" /> Pre-issuance audit
          </CardTitle>
          {audit.model && <AiLabel model={audit.model} />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <RiskBadge level={audit.risk_level} />
          <span className="text-sm">
            Risk score <span className="font-semibold tabular-nums">{audit.risk_score}</span>
            <span className="text-muted-foreground">/100</span>
          </span>
        </div>

        {audit.summary && <p className="text-sm leading-relaxed text-muted-foreground">{audit.summary}</p>}

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Findings</dt>
            <dd className="font-medium tabular-nums">{findings}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Reviewed by</dt>
            <dd className="truncate font-medium" title={audit.model ?? undefined}>
              {audit.model ?? 'Rule checks only'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Ruleset</dt>
            <dd className="font-mono text-xs">{audit.ruleset_version}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Audited</dt>
            <dd>{formatDate(audit.created_at)}</dd>
          </div>
        </dl>

        <ConsensusProof sequence={audit.hcs_sequence} label="Audit logged" />
      </CardContent>
    </Card>
  );
}
