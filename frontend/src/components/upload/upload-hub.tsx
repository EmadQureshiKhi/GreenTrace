'use client';

import { FileSpreadsheet, ListChecks, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BillReader } from './bill-reader';
import { SpreadsheetImport } from './spreadsheet-import';

export function UploadHub() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Measure emissions</h1>
          <p className="text-muted-foreground">Turn bills and activity spreadsheets into a reviewed Scope 1 and 2 inventory.</p>
        </div>
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/inventories">
            <ListChecks className="mr-2 h-4 w-4" />
            My inventories
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="ai" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="ai" className="gap-2">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="truncate">Read bills with AI</span>
          </TabsTrigger>
          <TabsTrigger value="spreadsheet" className="gap-2">
            <FileSpreadsheet className="h-4 w-4 shrink-0" />
            <span className="truncate">Import spreadsheet</span>
          </TabsTrigger>
        </TabsList>
        {/* forceMount keeps in-progress readings alive when switching tabs. */}
        <TabsContent value="ai" forceMount className="mt-0 data-[state=inactive]:hidden">
          <BillReader />
        </TabsContent>
        <TabsContent value="spreadsheet" forceMount className="mt-0 data-[state=inactive]:hidden">
          <SpreadsheetImport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
