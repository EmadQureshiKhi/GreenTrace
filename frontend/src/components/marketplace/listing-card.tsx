'use client';

import { Calendar, FileCheck2, Loader2, MapPin, ScrollText, ShoppingCart, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRateCredit } from '@/hooks/use-api';
import { toast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/format';
import type { CarbonCredit, CreditRating } from '@/lib/types';
import { ListingImage } from './listing-image';
import { RatingBadge } from './rating-badge';

interface ListingCardProps {
  credit: CarbonCredit;
  rating: CreditRating | undefined;
  isAuthenticated: boolean;
  /** undefined while the AI status is unknown */
  aiConfigured: boolean | undefined;
  onBuy: () => void;
  onViewRating: () => void;
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="min-w-0 truncate text-right font-medium" title={value ?? undefined}>
        {value || <span className="font-normal text-muted-foreground">Not stated</span>}
      </span>
    </div>
  );
}

export function ListingCard({ credit, rating, isAuthenticated, aiConfigured, onBuy, onViewRating }: ListingCardProps) {
  const rate = useRateCredit();
  const soldOut = credit.available <= 0;
  const availableShare = credit.total_supply > 0 ? Math.min(100, (credit.available / credit.total_supply) * 100) : 0;
  const registry = [credit.registry, credit.registry_project_id].filter(Boolean).join(' ') || null;

  const runRating = () =>
    rate.mutate(
      { creditId: credit.id },
      {
        onSuccess: (result) =>
          toast({ title: `Rated ${result.grade}`, description: `${credit.title} scored ${result.overall_score}/100.` }),
        onError: (error) => toast({ title: 'AI rating failed', description: errorMessage(error), variant: 'destructive' }),
      },
    );

  return (
    <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
      <div className="relative h-48 shrink-0 overflow-hidden">
        <ListingImage key={credit.image_url ?? 'none'} src={credit.image_url} alt={credit.title} label={credit.project_type} />
        <div className="absolute left-3 top-3">
          <Badge className="border-transparent bg-white/90 text-green-800 shadow-sm backdrop-blur-sm hover:bg-white/90 dark:bg-gray-900/90 dark:text-green-200">
            {credit.project_type}
          </Badge>
        </div>
        {soldOut && (
          <div className="absolute right-3 top-3">
            <Badge variant="secondary" className="shadow-sm">
              Sold out
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="space-y-1.5">
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug">{credit.title}</h3>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{credit.location}</span>
          </p>
          {credit.description && <p className="line-clamp-2 text-sm text-muted-foreground">{credit.description}</p>}
        </div>

        <div className="space-y-2">
          <Detail icon={<Calendar className="h-3.5 w-3.5" />} label="Vintage" value={credit.vintage} />
          <Detail icon={<ScrollText className="h-3.5 w-3.5" />} label="Methodology" value={credit.methodology} />
          <Detail icon={<FileCheck2 className="h-3.5 w-3.5" />} label="Registry" value={registry} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Available</span>
            <span className="font-medium tabular-nums">
              {credit.available.toLocaleString()} / {credit.total_supply.toLocaleString()} t
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${availableShare}%` }} />
          </div>
        </div>

        <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
          <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              AI quality rating
            </span>
            {rating ? (
              <div className="flex items-center gap-2">
                <RatingBadge rating={rating} />
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onViewRating}>
                  View rating
                </Button>
              </div>
            ) : isAuthenticated && aiConfigured !== false ? (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={runRating} disabled={rate.isPending}>
                {rate.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                {rate.isPending ? 'Rating...' : 'Rate with AI'}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">{aiConfigured === false ? 'AI rating unavailable' : 'Not rated yet'}</span>
            )}
          </div>
          {rate.isPending && (
            <p className="mt-1.5 text-xs text-muted-foreground">Reviewing the project facts. This can take up to a minute.</p>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 border-t pt-4">
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none text-primary tabular-nums">
              {Number(credit.price_hbar).toLocaleString(undefined, { maximumFractionDigits: 4 })}
              <span className="ml-1 text-sm font-semibold">HBAR</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">per tonne CO2e</p>
          </div>
          <Button onClick={onBuy} disabled={soldOut} className="shrink-0">
            <ShoppingCart className="mr-2 h-4 w-4" />
            {soldOut ? 'Sold out' : 'Buy'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
