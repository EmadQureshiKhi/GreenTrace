'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Award, Calculator, ChevronRight, ClipboardList, Upload } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCertificates, useInventories } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { errorMessage, formatTonnes } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { AiAudit, Certificate, EmissionData } from '@/lib/types';
import { RiskBadge, SourceBadge } from './badges';
import { formatDate, formatPeriod, isAuditCurrent } from './inventory-utils';

type LatestAudit = Pick<AiAudit, 'emission_data_id' | 'risk_level' | 'created_at'>;

/** Latest audit per inventory, for the status column. */
function useLatestAudits() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['audits', 'latest-by-inventory', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_audits')
        .select('emission_data_id, risk_level, created_at')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      const latest = new Map<string, LatestAudit>();
      for (const audit of (data ?? []) as LatestAudit[]) {
        if (!latest.has(audit.emission_data_id)) latest.set(audit.emission_data_id, audit);
      }
      return latest;
    },
  });
}

function Status({ inventory, certificate, audit }: { inventory: EmissionData; certificate?: Certificate; audit?: LatestAudit }) {
  if (certificate) {
    return (
      <Link
        href={`/certificates/${certificate.certificate_id}`}
        className="relative z-10 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 hover:underline dark:bg-emerald-950 dark:text-emerald-200"
      >
        <Award className="h-3 w-3" />
        Certified {certificate.certificate_id}
      </Link>
    );
  }
  if (audit) {
    const current = isAuditCurrent(audit, inventory);
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="whitespace-nowrap text-xs font-medium">{current ? 'Audited' : 'Audit out of date'}</span>
        <RiskBadge level={audit.risk_level} />
      </span>
    );
  }
  return <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Draft</span>;
}

export function InventoryList() {
  const inventories = useInventories();
  const certificates = useCertificates();
  const audits = useLatestAudits();

  const certificateByInventory = useMemo(() => {
    const map = new Map<string, Certificate>();
    for (const c of certificates.data ?? []) map.set(c.emission_data_id, c);
    return map;
  }, [certificates.data]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Inventories</h1>
          <p className="text-muted-foreground">Each inventory is a reviewed set of Scope 1 and 2 activity lines you can audit and certify.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="flex-1 sm:flex-none">
            <Link href="/ghg-calculator">
              <Calculator className="mr-2 h-4 w-4" />
              Calculator
            </Link>
          </Button>
          <Button asChild className="flex-1 sm:flex-none">
            <Link href="/upload">
              <Upload className="mr-2 h-4 w-4" />
              New from bills
            </Link>
          </Button>
        </div>
      </div>

      {inventories.isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Could not load your inventories: {errorMessage(inventories.error)}</AlertDescription>
        </Alert>
      )}

      {inventories.isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
            ))}
          </CardContent>
        </Card>
      ) : inventories.data && inventories.data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">No inventories yet</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Upload electricity, gas and fuel bills for the AI to read, import a spreadsheet, or enter activities in the GHG calculator.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button asChild>
                <Link href="/upload">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload bills or a spreadsheet
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/ghg-calculator">
                  <Calculator className="mr-2 h-4 w-4" />
                  Use the calculator
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : inventories.data ? (
        <Card className="overflow-hidden">
          <ul className="divide-y">
            {inventories.data.map((inventory) => (
              <li
                key={inventory.id}
                className="relative grid gap-3 px-4 py-4 transition-colors hover:bg-muted/50 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* The link stretches over the whole row; the certificate link sits above it. */}
                    <Link href={`/inventories/${inventory.id}`} className="min-w-0 truncate font-semibold after:absolute after:inset-0 focus:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring">
                      {inventory.organization || 'Unnamed organization'}
                    </Link>
                    <SourceBadge source={inventory.source} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatPeriod(inventory.reporting_period_start, inventory.reporting_period_end)}
                    <span className="mx-1.5">·</span>
                    Created {formatDate(inventory.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums">{formatTonnes(Number(inventory.total_emissions))}</p>
                  <p className="text-xs text-muted-foreground">CO2e</p>
                </div>
                <div className="min-w-0">
                  <Status
                    inventory={inventory}
                    certificate={certificateByInventory.get(inventory.id)}
                    audit={audits.data?.get(inventory.id)}
                  />
                </div>
                <ChevronRight className="hidden h-5 w-5 text-muted-foreground md:block" />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
