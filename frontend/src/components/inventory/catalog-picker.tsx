'use client';

import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { catalog, getCatalogEntry, type CatalogEntry } from '@/lib/emissions/catalog';
import { cn } from '@/lib/utils';
import { factorSourceTitle } from './factor-source';
import { catalogGroup } from './inventory-utils';

interface CatalogPickerProps {
  value: string | null;
  onChange: (entry: CatalogEntry) => void;
  invalid?: boolean;
  className?: string;
  placeholder?: string;
}

const groups: { name: string; entries: CatalogEntry[] }[] = (() => {
  const map = new Map<string, CatalogEntry[]>();
  for (const entry of catalog) {
    const name = catalogGroup(entry);
    map.set(name, [...(map.get(name) ?? []), entry]);
  }
  return [...map.entries()].map(([name, entries]) => ({ name, entries }));
})();

/** Searchable, grouped picker over the emission factor catalog. Opens in a dialog so it works inside scrolling tables. */
export function CatalogPicker({ value, onChange, invalid, className, placeholder = 'Choose an emission source' }: CatalogPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = value ? getCatalogEntry(value) : undefined;

  const filtered = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return groups;
    return groups
      .map((group) => ({
        name: group.name,
        entries: group.entries.filter((entry) => {
          const haystack = [group.name, entry.fuelType, entry.nativeUnit, entry.country?.code, ...(entry.country?.aliases ?? []), entry.source?.citation]
            .join(' ')
            .toLowerCase();
          return terms.every((term) => haystack.includes(term));
        }),
      }))
      .filter((group) => group.entries.length > 0);
  }, [query]);

  const choose = (entry: CatalogEntry) => {
    onChange(entry);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex min-h-10 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-1.5 text-left text-sm ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          invalid ? 'border-red-500 dark:border-red-500' : 'border-input',
          className,
        )}
        aria-haspopup="dialog"
      >
        {selected ? (
          <span className="min-w-0">
            <span className="block truncate font-medium">{selected.fuelType}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {/* A grid entry's name already says electricity; its source is more useful in the space. */}
              {selected.source ? `${selected.scope} · ${selected.source.citation}` : `${selected.scope} / ${selected.category}`}
            </span>
          </span>
        ) : (
          <span className="truncate text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-[calc(100vw-2rem)] flex-col gap-3 p-4 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>Emission source</DialogTitle>
            <DialogDescription>Each source has a fixed emission factor from the GreenTrace catalog.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search diesel, UK grid, R410A..."
              className="pl-9"
            />
          </div>
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No source matches &quot;{query}&quot;.</p>
            ) : (
              filtered.map((group) => (
                <div key={group.name} className="mb-3 last:mb-0">
                  <p className="sticky top-0 z-10 bg-background py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.name}
                  </p>
                  <ul>
                    {group.entries.map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => choose(entry)}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none',
                            entry.id === value && 'bg-primary/10 text-primary',
                          )}
                        >
                          <span className="min-w-0 truncate">{entry.fuelType}</span>
                          <span
                            className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"
                            title={entry.source ? factorSourceTitle(entry.source) : undefined}
                          >
                            {entry.source && <span>{entry.source.citation} ·</span>}
                            {entry.factor.toLocaleString(undefined, { maximumFractionDigits: 5 })} kg/{entry.nativeUnit}
                            {entry.id === value && <Check className="h-4 w-4 text-primary" />}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
