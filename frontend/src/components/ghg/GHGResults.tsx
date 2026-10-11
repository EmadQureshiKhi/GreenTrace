'use client';

import { Archive, ArrowLeft, Calculator, FileSpreadsheet, Leaf, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { formatDate, errorMessage, formatKg, formatTonnes } from '@/lib/format';
import type { CustomEquipmentTypes, EmissionEntry, EmissionFactorsDatabase, QuestionnaireData } from '@/types/ghg';
import { exportToExcel } from '@/utils/excelExport';
import { selectClass } from './field-styles';
import { GHGSaveInventory } from './GHGSaveInventory';

interface GHGResultsProps {
  questionnaire: QuestionnaireData;
  entries: EmissionEntry[];
  totalEmissions: number;
  emissionFactors: EmissionFactorsDatabase;
  customEquipmentTypes?: CustomEquipmentTypes;
  onBackToCalculator: () => void;
  onDeleteEntry?: (entryId: string) => void;
}

const GHGResults = ({ questionnaire, entries, totalEmissions, emissionFactors, customEquipmentTypes = {}, onBackToCalculator, onDeleteEntry }: GHGResultsProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel');

  const valid = entries.filter((e) => !e.issue);
  const scope1 = valid.filter((e) => e.scope === 'Scope 1').reduce((sum, e) => sum + e.emissions, 0);
  const scope2 = valid.filter((e) => e.scope === 'Scope 2').reduce((sum, e) => sum + e.emissions, 0);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportToExcel({ questionnaire, entries: valid, emissionFactors, totalEmissions }, exportFormat, customEquipmentTypes);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Export failed', description: errorMessage(error) });
    } finally {
      setIsExporting(false);
    }
  };

  const share = (kg: number) => (totalEmissions > 0 ? (kg / totalEmissions) * 100 : 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Calculation results</h1>
          <p className="truncate text-muted-foreground">
            {questionnaire.orgName || 'Organization'} · {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onBackToCalculator}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to calculator
          </Button>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value === 'csv' ? 'csv' : 'excel')}
            className={`${selectClass} sm:w-44`}
            aria-label="Export format"
          >
            <option value="excel">Excel (.xlsx)</option>
            <option value="csv">CSV (.csv)</option>
          </select>
          <Button variant="outline" onClick={handleExport} disabled={isExporting || valid.length === 0}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : exportFormat === 'excel' ? (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            ) : (
              <Archive className="mr-2 h-4 w-4" />
            )}
            {isExporting ? 'Exporting...' : 'Export report'}
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 p-6 text-white sm:p-8">
        <div className="absolute right-6 top-1/2 hidden h-20 w-20 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/30 bg-white/20 md:flex">
          <Leaf className="h-10 w-10 text-white" />
        </div>
        <div className="relative grid gap-6 sm:grid-cols-3 md:pr-28">
          {[
            { label: 'Scope 1', kg: scope1, note: 'direct emissions' },
            { label: 'Scope 2', kg: scope2, note: 'indirect emissions' },
            { label: 'Total CO2e', kg: totalEmissions, note: `${valid.length} ${valid.length === 1 ? 'activity' : 'activities'}` },
          ].map((item) => (
            <div key={item.label}>
              <h3 className="mb-1 text-sm font-semibold text-green-50">{item.label}</h3>
              <p className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums sm:text-4xl">{(item.kg / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-base font-medium">tonnes</span>
              </p>
              <p className="text-sm text-green-100">{item.note}</p>
            </div>
          ))}
        </div>
      </div>

      <GHGSaveInventory questionnaire={questionnaire} entries={entries} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="py-10 text-center">
              <Calculator className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">No entries yet</p>
              <p className="text-sm text-muted-foreground">Go back to the calculator to add activities.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[880px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Scope</th>
                    <th className="px-3 py-2.5 font-medium">Category and equipment</th>
                    <th className="px-3 py-2.5 font-medium">Fuel</th>
                    <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                    <th className="px-3 py-2.5 text-right font-medium">Factor</th>
                    <th className="px-3 py-2.5 text-right font-medium">Emissions</th>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    {onDeleteEntry && <th className="w-12 px-3 py-2.5" aria-label="Delete" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry) => (
                    <tr key={entry.id} className={entry.issue ? 'bg-red-50/70 align-top dark:bg-red-950/20' : 'align-top'}>
                      <td className="whitespace-nowrap px-3 py-3 font-medium">{entry.scope}</td>
                      <td className="px-3 py-3">
                        <p>{entry.category}</p>
                        {entry.equipmentType && <p className="text-xs text-muted-foreground">{entry.equipmentType}</p>}
                        {entry.fuelCategory !== entry.category && <p className="text-xs text-muted-foreground">{entry.fuelCategory}</p>}
                      </td>
                      <td className="px-3 py-3">
                        <p className="max-w-[220px] break-words">{entry.fuelType}</p>
                        {entry.custom && !entry.issue && (
                          <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                            Custom factor, not certifiable
                          </span>
                        )}
                        {entry.issue && <p className="mt-1 max-w-[260px] text-xs text-red-600 dark:text-red-400">{entry.issue}</p>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                        {entry.amount.toLocaleString()} {entry.unit_type}
                        {entry.nativeUnit && entry.nativeUnit !== entry.unit_type && entry.nativeQuantity !== undefined && !entry.issue && (
                          <p className="text-xs text-muted-foreground">
                            = {entry.nativeQuantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} {entry.nativeUnit}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground">
                        {entry.baseFactor.toLocaleString(undefined, { maximumFractionDigits: 5 })}
                        <span className="text-xs"> kg/{entry.nativeUnit ?? entry.unit_type}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">{entry.issue ? '-' : `${formatKg(entry.emissions)}`}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{entry.timestamp ? formatDate(entry.timestamp) : '-'}</td>
                      {onDeleteEntry && (
                        <td className="px-3 py-2">
                          <Button variant="ghost" size="icon" onClick={() => onDeleteEntry(entry.id)} aria-label={`Delete ${entry.fuelType} entry`}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {valid.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By scope</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              { label: 'Scope 1 (direct)', kg: scope1, count: valid.filter((e) => e.scope === 'Scope 1').length, bar: 'bg-emerald-500' },
              { label: 'Scope 2 (indirect)', kg: scope2, count: valid.filter((e) => e.scope === 'Scope 2').length, bar: 'bg-sky-500' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border p-4">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-2xl font-bold tabular-nums">{formatTonnes(item.kg)}</p>
                <p className="mb-2 text-sm text-muted-foreground">
                  {formatKg(item.kg)} CO2e · {item.count} {item.count === 1 ? 'activity' : 'activities'}
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${item.bar}`} style={{ width: `${share(item.kg)}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{share(item.kg).toFixed(1)}% of total</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GHGResults;
