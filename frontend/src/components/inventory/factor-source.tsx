import type { FactorSource } from '@/lib/emissions/catalog';
import { cn } from '@/lib/utils';

/** Full provenance of a factor, for tooltips: value basis, boundary, year and the publishing document. */
export function factorSourceTitle(source: FactorSource): string {
  return [
    `${source.gas === 'CO2' ? 'CO2 only' : 'CO2e'}, ${source.boundary}, ${source.dataYear} data.`,
    source.note,
    `${source.publisher}: ${source.title}.`,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Short citation ("DESNZ 2026") linking to the official document behind a catalog factor. */
export function FactorSourceLink({ source, className }: { source: FactorSource | null; className?: string }) {
  if (!source) return null;
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={factorSourceTitle(source)}
      className={cn('text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground', className)}
    >
      {source.citation}
    </a>
  );
}
