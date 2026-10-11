'use client';

import { AlertCircle, ArrowLeft, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAudits, useCertificateForInventory, useInventory, useInventoryDocuments } from '@/hooks/use-api';
import { errorMessage } from '@/lib/format';
import type { FindingSeverity } from '@/lib/types';
import { AuditPanel } from './audit-panel';
import { CertificatePanel } from './certificate-panel';
import { InventoryLines, type LineFlag } from './inventory-lines';
import { InventorySummary } from './inventory-summary';
import { inventoryLines } from './inventory-utils';
import { SourceDocuments } from './source-documents';

const RANK: Record<FindingSeverity, number> = { high: 3, medium: 2, low: 1, info: 0 };

function BackLink() {
  return (
    <Button variant="ghost" size="sm" asChild className="-ml-3 text-muted-foreground">
      <Link href="/inventories">
        <ArrowLeft className="mr-2 h-4 w-4" />
        All inventories
      </Link>
    </Button>
  );
}

/** Review and certification hub for one inventory. */
export function InventoryDetail({ id }: { id: string }) {
  const inventory = useInventory(id);
  const audits = useAudits(id);
  const certificate = useCertificateForInventory(id);
  const documents = useInventoryDocuments(id);

  const data = inventory.data;
  const lines = useMemo(() => (data ? inventoryLines(data) : []), [data]);
  const legacyRows = data && Array.isArray(data.processed_data) ? data.processed_data.length - lines.length : 0;
  const latestAudit = audits.data?.[0];

  const flags = useMemo(() => {
    const map = new Map<string, LineFlag>();
    for (const finding of latestAudit?.findings ?? []) {
      for (const lineId of finding.lineIds) {
        const existing = map.get(lineId);
        if (!existing) map.set(lineId, { severity: finding.severity, titles: [finding.title] });
        else {
          existing.titles.push(finding.title);
          if (RANK[finding.severity] > RANK[existing.severity]) existing.severity = finding.severity;
        }
      }
    }
    return map;
  }, [latestAudit]);

  if (inventory.isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <BackLink />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  // A malformed id is reported by Postgres as a uuid syntax error; treat it as not found.
  if (inventory.isError && !/uuid/i.test(errorMessage(inventory.error))) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <BackLink />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Could not load the inventory: {errorMessage(inventory.error)}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <BackLink />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <SearchX className="h-10 w-10 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Inventory not found</h1>
            <p className="max-w-sm text-sm text-muted-foreground">It does not exist, or it belongs to another account.</p>
            <Button asChild>
              <Link href="/inventories">See your inventories</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const certified = Boolean(certificate.data);
  const showDocuments = data.source === 'ai_extraction' || (documents.data?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackLink />
      <InventorySummary inventory={data} lineCount={lines.length} certified={Boolean(certificate.data)} />
      <InventoryLines
        inventory={data}
        lines={lines}
        documents={documents.data ?? []}
        flags={flags}
        editable={!certified && !certificate.isLoading}
        legacyRows={legacyRows}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <AuditPanel inventory={data} lines={lines} audits={audits.data} loading={audits.isLoading} loadError={audits.error} certified={certified} />
        </div>
        <div className="min-w-0 space-y-6">
          <CertificatePanel
            inventory={data}
            certificate={certificate.data}
            loading={certificate.isLoading}
            latestAudit={latestAudit}
            hasLines={lines.length > 0}
          />
          {showDocuments && <SourceDocuments documents={documents.data} loading={documents.isLoading} error={documents.error} />}
        </div>
      </div>
    </div>
  );
}
