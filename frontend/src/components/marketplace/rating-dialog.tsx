'use client';

import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { AiLabel } from '@/components/ai/ai-label';
import { AiUnavailable } from '@/components/ai/ai-unavailable';
import { ConsensusProof } from '@/components/chain/consensus-proof';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAiStatus, useRateCredit } from '@/hooks/use-api';
import { toast } from '@/hooks/use-toast';
import { RATING_WEIGHTS, type RatingDimension } from '@/lib/ai-math';
import { errorMessage, shortHash } from '@/lib/format';
import type { CarbonCredit, CreditRating } from '@/lib/types';
import { cn } from '@/lib/utils';
import { gradeSolidClass, ScoreBar } from './rating-badge';

const DIMENSIONS: { key: RatingDimension; label: string; hint: string }[] = [
  { key: 'additionality', label: 'Additionality', hint: 'Would the reductions have happened anyway?' },
  { key: 'permanence', label: 'Permanence', hint: 'Risk the carbon is released later' },
  { key: 'mrv', label: 'MRV', hint: 'Monitoring, reporting and verification' },
  { key: 'leakage', label: 'Leakage', hint: 'Risk emissions just move elsewhere' },
  { key: 'coBenefits', label: 'Co-benefits', hint: 'Benefits beyond carbon' },
];

const WEIGHTS_TEXT = DIMENSIONS.map((d) => `${d.key === 'mrv' ? d.label : d.label.toLowerCase()} ${Math.round(RATING_WEIGHTS[d.key] * 100)}%`).join(', ');

interface RatingDialogProps {
  credit: CarbonCredit | null;
  rating: CreditRating | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signedIn: boolean;
}

export function RatingDialog({ credit, rating, open, onOpenChange, signedIn }: RatingDialogProps) {
  const rerate = useRateCredit();
  const ai = useAiStatus();
  const canRate = signedIn && ai.data?.configured !== false;

  const runRerate = () => {
    if (!credit) return;
    rerate.mutate(
      { creditId: credit.id, refresh: true },
      {
        onSuccess: (result) => toast({ title: `Re-rated ${result.grade}`, description: `${credit.title} scored ${result.overall_score}/100.` }),
        onError: (error) => toast({ title: 'AI rating failed', description: errorMessage(error), variant: 'destructive' }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl gap-0 overflow-y-auto rounded-lg p-0">
        <DialogHeader className="space-y-1 border-b p-5 pr-12 text-left sm:p-6 sm:pr-12">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            AI quality rating
            <AiLabel model={rating?.model} text={rating?.model ?? 'AI'} />
          </DialogTitle>
          <DialogDescription>{credit?.title}</DialogDescription>
        </DialogHeader>

        {rating ? (
          <div className="space-y-6 p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-2xl font-extrabold tracking-tight shadow-sm',
                  gradeSolidClass(rating.grade),
                )}
              >
                {rating.grade}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Overall score</span>
                  <span className="text-xl font-bold tabular-nums">
                    {rating.overall_score}
                    <span className="text-sm font-medium text-muted-foreground">/100</span>
                  </span>
                </div>
                <ScoreBar score={rating.overall_score} className="h-2.5" />
                <p className="text-xs text-muted-foreground">Rated {format(new Date(rating.created_at), 'd MMM yyyy, HH:mm')}</p>
              </div>
            </div>

            {rating.summary && <p className="text-sm leading-relaxed">{rating.summary}</p>}

            <section className="space-y-4">
              <h4 className="text-sm font-semibold">Score breakdown</h4>
              {DIMENSIONS.map(({ key, label, hint }) => {
                const entry = rating.scores[key];
                if (!entry) return null;
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="font-medium">{label}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">{Math.round(RATING_WEIGHTS[key] * 100)}% weight</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{entry.score}</span>
                    </div>
                    <ScoreBar score={entry.score} />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      <span className="sr-only">{hint}. </span>
                      {entry.rationale}
                    </p>
                  </div>
                );
              })}
              <p className="rounded-md bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                The AI scores each dimension from the project facts. GreenTrace then computes the overall score from those dimension scores with fixed weights ({WEIGHTS_TEXT}) and maps it to a grade, so the model never picks the grade itself.
              </p>
            </section>

            {(rating.strengths.length > 0 || rating.risks.length > 0) && (
              <div className="grid gap-4 sm:grid-cols-2">
                <section className="space-y-2">
                  <h4 className="text-sm font-semibold">Strengths</h4>
                  {rating.strengths.length ? (
                    <ul className="space-y-2">
                      {rating.strengths.map((item) => (
                        <li key={item} className="flex gap-2 text-sm">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">None identified.</p>
                  )}
                </section>
                <section className="space-y-2">
                  <h4 className="text-sm font-semibold">Risks</h4>
                  {rating.risks.length ? (
                    <ul className="space-y-2">
                      {rating.risks.map((item) => (
                        <li key={item} className="flex gap-2 text-sm">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">None identified.</p>
                  )}
                </section>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <ConsensusProof sequence={rating.hcs_sequence} label="Rating logged on Hedera" />
                <p className="break-all font-mono text-xs text-muted-foreground" title={rating.rating_hash}>
                  Rating hash {shortHash(rating.rating_hash, 10, 8)}
                </p>
              </div>
              {canRate && (
                <Button variant="outline" size="sm" onClick={runRerate} disabled={rerate.isPending} className="shrink-0">
                  {rerate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  {rerate.isPending ? 'Re-rating...' : 'Re-rate'}
                </Button>
              )}
            </div>
            {rerate.isPending && <p className="text-xs text-muted-foreground">Running a fresh rating. This can take up to a minute.</p>}
            {signedIn && <AiUnavailable feature="Re-rating" />}
          </div>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">This project has not been rated yet.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
