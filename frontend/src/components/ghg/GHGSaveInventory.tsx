'use client';

import { ArrowRight, ClipboardCheck, Info, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSaveInventory, type InventoryLinePayload } from '@/hooks/use-api';
import { toast } from '@/hooks/use-toast';
import { errorMessage, formatTonnes } from '@/lib/format';
import type { EmissionEntry, QuestionnaireData } from '@/types/ghg';
import { isCertifiable } from './calculator-model';

interface GHGSaveInventoryProps {
  questionnaire: QuestionnaireData;
  entries: EmissionEntry[];
}

/** Turns calculator entries into a server-side inventory that can be audited and certified. */
export function GHGSaveInventory({ questionnaire, entries }: GHGSaveInventoryProps) {
  const router = useRouter();
  const save = useSaveInventory();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const included = entries.filter(isCertifiable);
  const custom = entries.filter((e) => e.custom && !e.issue);
  const broken = entries.filter((e) => e.issue);
  const includedKg = included.reduce((sum, e) => sum + e.emissions, 0);
  const organization = questionnaire.orgName.trim();

  const reason =
    included.length === 0
      ? 'Add at least one entry that uses a catalog fuel.'
      : !organization
        ? 'Enter the organization name in the questionnaire.'
        : start && end && end < start
          ? 'The reporting period ends before it starts.'
          : null;

  const submit = async () => {
    const seen = new Set<string>();
    const lines: InventoryLinePayload[] = included.map((entry, index) => {
      let id = entry.id.slice(0, 64);
      if (seen.has(id)) id = `${id.slice(0, 56)}-${index + 1}`;
      seen.add(id);
      return {
        id,
        catalogId: entry.catalogId,
        quantity: entry.amount,
        unit: entry.unit_type,
        description: entry.equipmentType ? entry.equipmentType.slice(0, 500) : null,
      };
    });
    try {
      const inventory = await save.mutateAsync({
        payload: {
          source: 'calculator',
          organization,
          fileName: null,
          reportingPeriodStart: start || null,
          reportingPeriodEnd: end || null,
          lines,
          rawData: [questionnaire],
        },
      });
      toast({ title: 'Inventory saved', description: `${formatTonnes(Number(inventory.total_emissions))} CO2e from ${lines.length} entries.` });
      router.push(`/inventories/${inventory.id}`);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not save the inventory', description: errorMessage(error) });
    }
  };

  return (
    <Card className="border-emerald-200 dark:border-emerald-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          Save as inventory
        </CardTitle>
        <CardDescription>
          Creates an inventory from these entries. The server recalculates every line from the catalog; you can then run the AI audit and issue a certificate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Organization</Label>
            <p className="flex h-10 items-center truncate rounded-md border border-input bg-muted/40 px-3 text-sm" title={organization}>
              {organization || <span className="text-muted-foreground">Not set</span>}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="save-start">Reporting period start</Label>
            <Input id="save-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="dark:[color-scheme:dark]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="save-end">Reporting period end</Label>
            <Input id="save-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="dark:[color-scheme:dark]" />
          </div>
        </div>

        {(custom.length > 0 || broken.length > 0) && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 [&>svg]:text-amber-600">
            <Info className="h-4 w-4" />
            <AlertDescription className="space-y-1">
              {custom.length > 0 && (
                <p>
                  {custom.length} {custom.length === 1 ? 'entry uses' : 'entries use'} a custom emission factor and will be left out. Certificates only cover factors
                  from the GreenTrace catalog, which the server can verify; a custom factor is your own estimate.
                </p>
              )}
              {broken.length > 0 && (
                <p>
                  {broken.length} saved {broken.length === 1 ? 'entry' : 'entries'} could not be recalculated and will be left out. Delete and re-enter{' '}
                  {broken.length === 1 ? 'it' : 'them'}.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <span className="font-semibold tabular-nums">{included.length}</span> {included.length === 1 ? 'entry' : 'entries'},{' '}
            <span className="font-semibold tabular-nums">{formatTonnes(includedKg)}</span> CO2e
          </p>
          <Button onClick={submit} disabled={Boolean(reason) || save.isPending} className="w-full sm:w-auto">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {save.isPending ? 'Saving...' : 'Save as inventory'}
            {!save.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>
        {reason && entries.length > 0 && <p className="text-sm text-muted-foreground">{reason}</p>}
      </CardContent>
    </Card>
  );
}
