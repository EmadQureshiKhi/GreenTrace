import { Flame } from 'lucide-react';
import { ConsensusProof } from '@/components/chain/consensus-proof';
import { ExplorerLink } from '@/components/chain/explorer-link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Retirement } from '@/lib/types';
import { RetirementStatusBadge } from './certificate-badges';
import { formatDate } from './certificate-utils';

export function RetirementHistory({ retirements }: { retirements: Retirement[] }) {
  const retired = retirements.filter((r) => r.status === 'completed').reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Flame className="h-5 w-5 text-primary" /> Retirement history
        </CardTitle>
        <CardDescription>
          {retirements.length === 0
            ? 'Carbon credits retired against this certificate are burned on Hedera and listed here.'
            : `${retired.toLocaleString()} t CO2e retired against this certificate. Retired credits are burned and cannot be reused.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {retirements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No credits have been retired against this certificate yet.</p>
        ) : (
          <div className="-mx-6 overflow-x-auto px-6">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 text-right font-medium">Tonnes</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Burn transaction</th>
                  <th className="pb-2 font-medium">Consensus record</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {retirements.map((retirement) => (
                  <tr key={retirement.id} className="align-top">
                    <td className="whitespace-nowrap py-2.5 pr-4">{formatDate(retirement.completed_at ?? retirement.created_at)}</td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-right font-medium tabular-nums">{Number(retirement.amount).toLocaleString()} t</td>
                    <td className="py-2.5 pr-4">
                      <RetirementStatusBadge status={retirement.status} />
                      {retirement.status === 'failed' && retirement.error && (
                        <p className="mt-1 line-clamp-2 max-w-[14rem] text-xs text-muted-foreground" title={retirement.error}>
                          {retirement.error}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      {retirement.wipe_tx_id ? <ExplorerLink kind="transaction" id={retirement.wipe_tx_id} /> : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="py-2.5">
                      {retirement.hcs_sequence ? (
                        <ConsensusProof sequence={retirement.hcs_sequence} label="Logged" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
