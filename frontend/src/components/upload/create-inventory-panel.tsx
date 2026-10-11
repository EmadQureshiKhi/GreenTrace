'use client';

import { ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { periodBounds } from '@/components/inventory/inventory-utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSaveInventory } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { errorMessage, formatKg, formatTonnes } from '@/lib/format';
import { draftToPayload, evaluateDraft, type DraftLine } from './draft-lines';

interface CreateInventoryPanelProps {
  lines: DraftLine[];
  source: 'ai_extraction' | 'upload';
  fileName: string | null;
  rawData?: unknown[];
  /** A reason creation must wait, such as files still being read. */
  blocker?: string | null;
}

/** Organization, reporting period and the "Create inventory" action for reviewed lines. */
export function CreateInventoryPanel({ lines, source, fileName, rawData, blocker }: CreateInventoryPanelProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const save = useSaveInventory();
  const [organization, setOrganization] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);

  const bounds = useMemo(() => periodBounds(lines.map((l) => ({ periodStart: l.periodStart || null, periodEnd: l.periodEnd || null }))), [lines]);
  const org = organization ?? profile?.organization ?? '';
  const periodStart = start ?? bounds.start ?? '';
  const periodEnd = end ?? bounds.end ?? '';

  const results = lines.map(evaluateDraft);
  const failing = results.filter((r) => !r.ok).length;
  const totalKg = results.reduce((sum, r) => sum + (r.ok ? r.line.emissions : 0), 0);

  const reason =
    blocker ??
    (lines.length === 0
      ? 'Add at least one line.'
      : failing > 0
        ? `${failing} ${failing === 1 ? 'line needs' : 'lines need'} fixing before the inventory can be created.`
        : !org.trim()
          ? 'Enter the organization name.'
          : periodStart && periodEnd && periodEnd < periodStart
            ? 'The reporting period ends before it starts.'
            : null);

  const create = async () => {
    try {
      const inventory = await save.mutateAsync({
        payload: {
          source,
          organization: org.trim(),
          fileName: fileName ? fileName.slice(0, 255) : null,
          reportingPeriodStart: periodStart || null,
          reportingPeriodEnd: periodEnd || null,
          lines: lines.map(draftToPayload),
          rawData,
        },
      });
      toast({ title: 'Inventory created', description: `${formatTonnes(Number(inventory.total_emissions))} CO2e across ${lines.length} lines.` });
      router.push(`/inventories/${inventory.id}`);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not create the inventory', description: errorMessage(error) });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Create inventory</CardTitle>
        <CardDescription>
          The server recalculates every line from the emission factor catalog when it saves. You can audit and certify the inventory next.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`${source}-org`}>Organization</Label>
            <Input id={`${source}-org`} value={org} onChange={(e) => setOrganization(e.target.value)} placeholder="Organization name" maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${source}-start`}>Reporting period start</Label>
            <Input id={`${source}-start`} type="date" value={periodStart} onChange={(e) => setStart(e.target.value)} className="dark:[color-scheme:dark]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${source}-end`}>Reporting period end</Label>
            <Input id={`${source}-end`} type="date" value={periodEnd} onChange={(e) => setEnd(e.target.value)} className="dark:[color-scheme:dark]" />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-lg bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Lines</p>
              <p className="text-lg font-semibold tabular-nums">
                {lines.length - failing}
                {failing > 0 && <span className="text-sm font-normal text-red-600 dark:text-red-400"> + {failing} to fix</span>}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatTonnes(totalKg)} <span className="text-sm font-normal text-muted-foreground">CO2e ({formatKg(totalKg)})</span>
              </p>
            </div>
          </div>
          <Button onClick={create} disabled={Boolean(reason) || save.isPending} className="w-full sm:w-auto">
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {save.isPending ? 'Creating...' : 'Create inventory'}
            {!save.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>

        {reason && lines.length > 0 && (
          <Alert>
            <AlertDescription className="text-muted-foreground">{reason}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
