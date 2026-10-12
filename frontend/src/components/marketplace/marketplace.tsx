'use client';

import { AlertCircle, Coins, Globe2, Layers, Leaf, RefreshCw, Search, ShoppingCart, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AiUnavailable } from '@/components/ai/ai-unavailable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAiStatus } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { filterListings, marketStats, SORT_OPTIONS, useMarketplaceData, type SortKey } from '@/hooks/use-marketplace';
import { toast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/format';
import type { CarbonCredit, Order } from '@/lib/types';
import { ListingCard } from './listing-card';
import { MyOrders } from './my-orders';
import { PurchaseDialog, type PurchaseTarget } from './purchase-dialog';
import { RatingDialog } from './rating-dialog';

export function Marketplace() {
  const { isAuthenticated } = useAuth();
  const { credits, ratings, ratingsById, creditsById, projectTypes } = useMarketplaceData();
  const ai = useAiStatus();
  const aiConfigured = ai.data?.configured;

  const [query, setQuery] = useState('');
  const [projectType, setProjectType] = useState('all');
  const [sort, setSort] = useState<SortKey>('price-asc');

  const [ratingCreditId, setRatingCreditId] = useState<string | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [purchase, setPurchase] = useState<PurchaseTarget | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const purchaseKey = useRef(0);

  const list = useMemo(() => credits.data ?? [], [credits.data]);
  const stats = useMemo(() => marketStats(list), [list]);
  const visible = useMemo(() => filterListings(list, ratingsById, { query, projectType, sort }), [list, ratingsById, query, projectType, sort]);
  const filtered = query.trim() !== '' || projectType !== 'all';

  const openPurchase = (credit: CarbonCredit, quantity = 1, order: Order | null = null) => {
    purchaseKey.current += 1;
    setPurchase({ key: purchaseKey.current, credit, quantity, order });
    setPurchaseOpen(true);
  };

  // Prefill from the AI offset advisor: /marketplace?credit=<id>&qty=<n> opens that listing's purchase dialog.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const prefillCredit = searchParams.get('credit');
  const prefillQty = searchParams.get('qty');
  const handledPrefill = useRef<string | null>(null);

  useEffect(() => {
    if (!prefillCredit) {
      handledPrefill.current = null;
      return;
    }
    if (!credits.data) return;
    const signature = `${prefillCredit}:${prefillQty ?? ''}`;
    if (handledPrefill.current === signature) return;
    handledPrefill.current = signature;
    const credit = credits.data.find((c) => c.id === prefillCredit || c.slug === prefillCredit);
    if (!credit) {
      toast({ title: 'Listing not found', description: 'The project you followed a link to is no longer listed.', variant: 'destructive' });
      router.replace(pathname, { scroll: false });
      return;
    }
    if (credit.available <= 0) {
      toast({ title: 'Sold out', description: `${credit.title} has no credits left.`, variant: 'destructive' });
      router.replace(pathname, { scroll: false });
      return;
    }
    const qty = Number.parseInt(prefillQty ?? '1', 10);
    purchaseKey.current += 1;
    setPurchase({ key: purchaseKey.current, credit, quantity: Number.isFinite(qty) && qty > 0 ? qty : 1, order: null });
    setPurchaseOpen(true);
  }, [prefillCredit, prefillQty, credits.data, router, pathname]);

  const handlePurchaseOpenChange = (open: boolean) => {
    setPurchaseOpen(open);
    // Drop the prefill parameters so a reload does not reopen the dialog.
    if (!open && prefillCredit) router.replace(pathname, { scroll: false });
  };

  const clearFilters = () => {
    setQuery('');
    setProjectType('all');
  };

  return (
    <div className="space-y-6">
      <Hero />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Projects" icon={<Layers className="h-5 w-5" />} loading={credits.isLoading} value={stats.projects.toLocaleString()} />
        <StatCard
          label="Credits available"
          icon={<Leaf className="h-5 w-5" />}
          loading={credits.isLoading}
          value={stats.availableTonnes.toLocaleString()}
          unit="t CO2e"
        />
        <StatCard
          label="Average price"
          icon={<Coins className="h-5 w-5" />}
          loading={credits.isLoading}
          value={stats.averagePriceHbar === null ? '-' : stats.averagePriceHbar.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          unit={stats.averagePriceHbar === null ? undefined : 'HBAR/t'}
        />
        <StatCard label="Countries" icon={<Globe2 className="h-5 w-5" />} loading={credits.isLoading} value={stats.countries.toLocaleString()} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search projects, locations, methodologies..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              aria-label="Search projects"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 md:flex">
            <Select value={projectType} onValueChange={setProjectType}>
              <SelectTrigger className="md:w-52" aria-label="Project type">
                <SelectValue placeholder="All project types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All project types</SelectItem>
                {projectTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
              <SelectTrigger className="md:w-48" aria-label="Sort listings">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isAuthenticated && <AiUnavailable feature="AI credit rating" />}
      {ratings.isError && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0" />
          AI ratings could not be loaded: {errorMessage(ratings.error)}
        </p>
      )}

      {credits.isLoading ? (
        <ListingSkeletons />
      ) : credits.isError ? (
        <EmptyState
          icon={<AlertCircle className="h-12 w-12 text-destructive" />}
          title="Could not load the marketplace"
          description={errorMessage(credits.error)}
          action={
            <Button variant="outline" onClick={() => credits.refetch()} disabled={credits.isFetching}>
              <RefreshCw className={credits.isFetching ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} /> Try again
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-12 w-12 text-muted-foreground" />}
          title="No listings yet"
          description="Carbon credit projects appear here as soon as they are listed."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Search className="h-12 w-12 text-muted-foreground" />}
          title="No projects match your search"
          description="Try a different search term or project type."
          action={
            <Button variant="outline" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" /> Clear filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {filtered ? `Showing ${visible.length} of ${list.length} projects` : `${list.length} ${list.length === 1 ? 'project' : 'projects'}`}
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((credit) => (
              <ListingCard
                key={credit.id}
                credit={credit}
                rating={ratingsById.get(credit.id)}
                isAuthenticated={isAuthenticated}
                aiConfigured={aiConfigured}
                onBuy={() => openPurchase(credit)}
                onViewRating={() => {
                  setRatingCreditId(credit.id);
                  setRatingOpen(true);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {isAuthenticated && <MyOrders creditsById={creditsById} onResume={(order, credit) => openPurchase(credit, order.quantity, order)} />}

      <RatingDialog
        credit={ratingCreditId ? creditsById.get(ratingCreditId) ?? null : null}
        rating={ratingCreditId ? ratingsById.get(ratingCreditId) : undefined}
        open={ratingOpen}
        onOpenChange={setRatingOpen}
        signedIn={isAuthenticated}
      />
      <PurchaseDialog target={purchase} open={purchaseOpen} onOpenChange={handlePurchaseOpenChange} />
    </div>
  );
}

function Hero() {
  return (
    <Card className="relative overflow-hidden border-0">
      <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-emerald-600" />
      <div className="absolute inset-0 hidden opacity-20 sm:block">
        <div className="absolute right-20 top-6 h-20 w-20 rounded-full border-2 border-white" />
        <div className="absolute right-32 top-12 h-12 w-12 rounded-full border border-white" />
        <div className="absolute bottom-8 right-24 h-6 w-6 rounded-full bg-white" />
        <div className="absolute right-8 top-16 h-8 w-8 rounded-full border border-white" />
        <div className="absolute bottom-12 right-40 h-4 w-4 rounded-full bg-white" />
      </div>
      <div className="absolute right-8 top-1/2 hidden -translate-y-1/2 md:block">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/30 bg-white/20 backdrop-blur-sm">
          <Leaf className="h-10 w-10 text-white" />
        </div>
      </div>

      <CardContent className="relative z-10 px-6 py-8 text-white">
        <div className="max-w-2xl">
          <h1 className="mb-4 text-3xl font-extrabold leading-tight tracking-tight text-white">Carbon Credit Marketplace</h1>
          <p className="mb-3 max-w-xl text-lg font-medium leading-relaxed text-green-50">
            Buy verified carbon credits to offset your emissions and support climate projects worldwide. Every listing can be rated by AI on five quality dimensions.
          </p>
          <p className="max-w-xl text-sm leading-relaxed text-green-100">
            You pay in HBAR from your own wallet on Hedera, the credits arrive as CO2e tokens, and every purchase is logged on Hedera Consensus Service.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            {['AI quality ratings', 'Paid in HBAR', 'Logged on Hedera'].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-300" />
                <span className="text-xs font-semibold tracking-wide text-green-100">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, unit, icon, loading }: { label: string; value: string; unit?: string; icon: ReactNode; loading: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-6">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
          {loading ? (
            <div className="mt-2 h-7 w-16 animate-pulse rounded bg-muted" />
          ) : (
            <p className="mt-1 flex flex-wrap items-baseline gap-x-1 text-xl font-bold tabular-nums sm:text-2xl">
              {value}
              {unit && <span className="text-xs font-medium text-muted-foreground sm:text-sm">{unit}</span>}
            </p>
          )}
        </div>
        <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 sm:flex">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        {icon}
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="max-w-md break-words text-sm text-muted-foreground">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}

export function ListingSkeletons() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Card key={i} className="animate-pulse overflow-hidden">
          <div className="h-48 bg-muted" />
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <div className="h-5 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/3 rounded bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="h-3 rounded bg-muted" />
              <div className="h-3 rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </div>
            <div className="flex items-end justify-between border-t pt-4">
              <div className="h-7 w-24 rounded bg-muted" />
              <div className="h-10 w-20 rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Shown while the page waits for the URL search params (Suspense fallback). */
export function MarketplaceSkeleton() {
  return (
    <div className="space-y-6">
      <Hero />
      <ListingSkeletons />
    </div>
  );
}
