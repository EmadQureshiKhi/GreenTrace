'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCatalogEntry } from '@/lib/emissions/catalog';
import { cn } from '@/lib/utils';

/** Unit picker limited to the units the chosen catalog entry accepts. */
export function UnitSelect({
  catalogId,
  value,
  onChange,
  className,
  disabled,
}: {
  catalogId: string | null;
  value: string;
  onChange: (unit: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const entry = catalogId ? getCatalogEntry(catalogId) : undefined;
  const units = entry?.units ?? [];
  const invalid = Boolean(entry && value && !units.includes(value));

  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled || !entry}>
      <SelectTrigger className={cn(invalid && 'border-red-500 dark:border-red-500', className)} aria-label="Unit">
        <SelectValue placeholder={entry ? 'Unit' : 'Pick a source'} />
      </SelectTrigger>
      <SelectContent>
        {invalid && (
          <SelectItem value={value} disabled>
            {value} (not valid)
          </SelectItem>
        )}
        {units.map((unit) => (
          <SelectItem key={unit} value={unit}>
            {unit}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
