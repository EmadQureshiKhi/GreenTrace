'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { AlertCircle, FileUp, History, Loader2, Sparkles, TrendingDown } from 'lucide-react';
import { AiUnavailable } from '@/components/ai/ai-unavailable';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAiStatus, useCreateReductionPlan, useInventories, useReductionPlans } from '@/hooks/use-api';
import { toast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/format';
import type { ReductionPlan } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatT } from './format';
import { InventorySummary } from './inventory-summary';
import { PlanForm, defaultTargetYear, type PlanFormValues } from './plan-form';
import { PlanResult } from './plan-result';

function Header() {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-green-600 to-emerald-600">
        <TrendingDown className="h-6 w-6 text-white" />
      </div>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold sm:text-3xl">Reduction planner</h1>
        <p className="text-muted-foreground">A decarbonization plan for your measured Scope 1 and 2 emissions, quantified from your own inventory</p>
      </div>
    </div>
  );
}

export function ReductionPlannerSkeleton() {
  return (
    <div className="space-y-6">
      <Header />
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="h-72 animate-pulse rounded-lg border bg-muted/50" />
          <div className="h-96 animate-pulse rounded-lg border bg-muted/50" />
        </div>
        <div className="h-[28rem] animate-pulse rounded-lg border bg-muted/50" />
      </div>
    </div>
  );
}

function GeneratingCard() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  // Asymptotic: it shows the wait is moving without claiming a finish time.
  const progress = Math.min(95, Math.round(100 * (1 - Math.exp(-seconds / 45))));
  return (
    <Card role="status">
      <CardContent className="space-y-4 py-10 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
        <div>
          <p className="font-medium">Building your reduction plan... {seconds}s</p>
          <p className="text-sm text-muted-foreground">The AI proposes measures; GreenTrace then quantifies them from your inventory. Usually 30 to 90 seconds.</p>
        </div>
        <Progress value={progress} className="mx-auto h-1.5 max-w-sm" />
      </CardContent>
    </Card>
  );
}

function PlanHistory({ plans, selectedId, onSelect }: { plans: ReductionPlan[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" /> Previous plans
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              aria-pressed={p.id === selectedId}
              className={cn(
                'shrink-0 rounded-md border px-3 py-2 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                p.id === selectedId ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/50' : 'hover:bg-muted',
              )}
            >
              <span className="block font-medium">{format(new Date(p.created_at), 'PP p')}</span>
              <span className="block text-muted-foreground">
                -{p.plan.reductionPercent}% by {p.plan.targetYear}, {formatT(p.plan.totalAnnualReductionTonnes)} t/yr
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReductionPlanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requestedId = searchParams.get('inventory');

  const inventories = useInventories();
  const [inventoryId, setInventoryId] = useState<string | null>(requestedId);
  // The search params can arrive after the first client render of this statically rendered page;
  // follow the link's inventory whenever it changes.
  useEffect(() => {
    if (requestedId) setInventoryId(requestedId);
  }, [requestedId]);
  const list = inventories.data ?? [];
  const selected = list.find((i) => i.id === inventoryId) ?? list[0] ?? null;
  const requestedMissing = Boolean(requestedId && inventories.isSuccess && !list.some((i) => i.id === requestedId));

  const plans = useReductionPlans(selected?.id);
  const createPlan = useCreateReductionPlan();
  const { data: aiStatus } = useAiStatus();
  const [planId, setPlanId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanFormValues>({ industry: '', region: '', budget: 'medium', targetYear: defaultTargetYear(), notes: '' });

  const planList = (plans.data ?? []).filter((p) => p.emission_data_id === selected?.id);
  const shownPlan = planList.find((p) => p.id === planId) ?? planList[0] ?? null;
  const pendingForSelected = createPlan.isPending && createPlan.variables?.emissionDataId === selected?.id;

  const selectInventory = (id: string) => {
    setInventoryId(id);
    setPlanId(null);
    createPlan.reset();
    const params = new URLSearchParams(searchParams.toString());
    params.set('inventory', id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const generate = () => {
    if (!selected) return;
    createPlan.mutate(
      {
        emissionDataId: selected.id,
        industry: form.industry.trim(),
        region: form.region.trim(),
        budget: form.budget,
        targetYear: form.targetYear,
        notes: form.notes.trim() || undefined,
      },
      {
        onSuccess: (plan) => {
          setPlanId(plan.id);
          toast({ title: 'Reduction plan ready', description: `-${plan.plan.reductionPercent}% by ${plan.plan.targetYear}` });
        },
      },
    );
  };

  if (inventories.isLoading) return <ReductionPlannerSkeleton />;

  if (inventories.isError) {
    return (
      <div className="space-y-6">
        <Header />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load your inventories</AlertTitle>
          <AlertDescription>{errorMessage(inventories.error)}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="space-y-6">
        <Header />
        <Card>
          <CardContent className="flex flex-col items-center px-4 py-14 text-center">
            <FileUp className="mb-3 h-10 w-10 text-muted-foreground" />
            <h2 className="mb-1 text-lg font-semibold">No emissions inventory yet</h2>
            <p className="mb-5 max-w-md text-sm text-muted-foreground">
              Reduction plans are built from a measured inventory. Upload utility bills or enter activity data to create one.
            </p>
            <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Link href="/upload">Create an inventory</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const noEmissions = Number(selected.total_emissions) <= 0;
  const disabledReason = aiStatus?.configured === false ? 'An AI provider is not configured on the server.' : noEmissions ? 'This inventory has no emissions to reduce.' : null;

  return (
    <div className="space-y-6">
      <Header />
      <AiUnavailable feature="The reduction planner" />
      {requestedMissing && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>The inventory in the link was not found in your account, so your latest inventory is shown.</AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-6">
          <InventorySummary inventories={list} selected={selected} onSelect={selectInventory} />
          <PlanForm values={form} onChange={setForm} onSubmit={generate} isPending={pendingForSelected} disabledReason={disabledReason} />
        </div>

        <div className="min-w-0 space-y-6">
          {createPlan.isError && createPlan.variables?.emissionDataId === selected.id && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>The plan could not be generated</AlertTitle>
              <AlertDescription>{errorMessage(createPlan.error)}</AlertDescription>
            </Alert>
          )}
          {plans.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Could not load previous plans: {errorMessage(plans.error)}</AlertDescription>
            </Alert>
          )}

          {pendingForSelected && <GeneratingCard />}

          {planList.length > 1 && <PlanHistory plans={planList} selectedId={shownPlan?.id ?? null} onSelect={setPlanId} />}

          {plans.isLoading ? (
            <div className="h-[28rem] animate-pulse rounded-lg border bg-muted/50" />
          ) : shownPlan ? (
            <PlanResult plan={shownPlan} />
          ) : (
            !pendingForSelected && (
              <Card className="border-dashed">
                <CardHeader className="items-center text-center">
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                    <Sparkles className="h-6 w-6 text-emerald-600" />
                  </div>
                  <CardTitle>No plan for this inventory yet</CardTitle>
                  <CardDescription className="max-w-md">
                    Fill in the settings and generate a plan. You get prioritized measures, the tonnes each removes per year and a trajectory to your target
                    year. Every plan is saved and its hash anchored on Hedera.
                  </CardDescription>
                </CardHeader>
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  );
}
