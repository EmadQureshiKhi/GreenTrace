'use client';

import { AlertTriangle, Leaf, Lightbulb, Trash2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatKg } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { EmissionEntry } from '@/types/ghg';
import AnimatedCounter from './AnimatedCounter';

interface GHGResultsSidebarProps {
  entries: EmissionEntry[];
  totalEmissions: number;
  onDeleteEntry?: (entryId: string) => void;
  onDeleteAll?: () => void;
  highlightResults?: boolean;
  lastEntryId?: string;
}

const GHGResultsSidebar = ({ entries, totalEmissions, onDeleteEntry, onDeleteAll, highlightResults = false, lastEntryId }: GHGResultsSidebarProps) => {
  const customCount = entries.filter((e) => e.custom && !e.issue).length;
  const issueCount = entries.filter((e) => e.issue).length;

  return (
    <div className="space-y-6">
      <motion.div
        className={cn(
          'relative overflow-hidden rounded-xl bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 p-6 text-white transition-shadow duration-500',
          highlightResults ? 'shadow-2xl ring-4 ring-green-300/70' : 'shadow-lg',
        )}
        animate={highlightResults ? { scale: [1, 1.02, 1] } : {}}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      >
        <div className="absolute right-5 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/20">
          <Leaf className="h-7 w-7 text-white" />
        </div>
        <div className="relative pr-16">
          <h3 className="mb-1 text-sm font-semibold text-green-50">Total CO2 equivalent</h3>
          <p className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">
              <AnimatedCounter value={totalEmissions / 1000} decimals={2} />
            </span>
            <span className="text-base font-medium">tonnes</span>
          </p>
          <p className="text-sm text-green-100">
            {entries.length} {entries.length === 1 ? 'activity' : 'activities'}
          </p>
        </div>
      </motion.div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">This session</CardTitle>
          {entries.length > 0 && onDeleteAll && (
            <Button variant="ghost" size="sm" onClick={onDeleteAll} className="h-8 text-red-600 hover:text-red-700 dark:text-red-400">
              <X className="mr-1 h-4 w-4" />
              Clear all
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries yet. Add an activity to see its emissions here.</p>
          ) : (
            <div className="space-y-2">
              {entries.slice(-5).map((entry) => {
                const isLast = entry.id === lastEntryId;
                return (
                  <motion.div
                    key={entry.id}
                    initial={isLast ? { scale: 0.95, opacity: 0 } : false}
                    animate={isLast ? { scale: 1, opacity: 1 } : {}}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className={cn(
                      'group rounded-lg border p-3 transition-colors',
                      isLast ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40' : 'border-transparent bg-muted/50',
                      entry.issue && 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" title={entry.fuelType}>
                          {entry.fuelType}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.scope} · {entry.category}
                          {entry.equipmentType && ` · ${entry.equipmentType}`}
                        </p>
                        <p className="text-sm">
                          {entry.amount.toLocaleString()} {entry.unit_type} ={' '}
                          {entry.issue ? (
                            <span className="font-medium text-red-600 dark:text-red-400">needs re-entry</span>
                          ) : isLast ? (
                            <AnimatedCounter value={entry.emissions} decimals={2} suffix=" kg CO2e" className="font-medium text-green-700 dark:text-green-400" />
                          ) : (
                            <span className="font-medium">{formatKg(entry.emissions)} CO2e</span>
                          )}
                        </p>
                        {entry.custom && !entry.issue && (
                          <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                            Custom factor, estimate
                          </span>
                        )}
                      </div>
                      {onDeleteEntry && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-600"
                          onClick={() => onDeleteEntry(entry.id)}
                          aria-label={`Delete ${entry.fuelType} entry`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              {entries.length > 5 && <p className="pt-1 text-center text-xs text-muted-foreground">Showing the last 5 of {entries.length}</p>}
            </div>
          )}
          {(customCount > 0 || issueCount > 0) && (
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              {customCount > 0 && <p>{customCount} {customCount === 1 ? 'entry uses' : 'entries use'} a custom factor and will not be certified.</p>}
              {issueCount > 0 && (
                <p className="flex items-start gap-1 text-red-600 dark:text-red-400">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {issueCount} saved {issueCount === 1 ? 'entry' : 'entries'} could not be recalculated. Delete and re-enter them.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40">
        <CardContent className="space-y-3 p-5">
          <p className="flex items-center gap-2 font-semibold text-sky-900 dark:text-sky-100">
            <Lightbulb className="h-4 w-4" />
            Tips
          </p>
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-sky-800 dark:text-sky-200">
            <li>Enter quantities in the unit on your bill; GreenTrace converts them to the factor&apos;s unit.</li>
            <li>Only units that fit the fuel are offered, so kg of diesel or litres of coal cannot slip in.</li>
            <li>When you are done, save the entries as an inventory to audit and certify them.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default GHGResultsSidebar;
