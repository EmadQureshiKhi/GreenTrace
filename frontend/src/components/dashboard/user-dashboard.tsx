'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowRight, Award, CheckCircle2, Circle, FileText, Leaf, ShoppingCart, TrendingDown, Upload, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useCertificates, useInventories, useOrders, useWalletStatus } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { formatTonnes } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { AiAudit, Retirement } from '@/lib/types';
import { cn } from '@/lib/utils';

function useMyAudits(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-audits', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_audits').select('emission_data_id, risk_level, created_at').order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Pick<AiAudit, 'emission_data_id' | 'risk_level' | 'created_at'>[];
    },
  });
}

function useMyRetirements(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-retirements', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from('retirements').select('*').eq('user_id', userId!).order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Retirement[];
    },
  });
}

function Kpi({ icon: Icon, label, value, hint, loading }: { icon: typeof Leaf; label: string; value: string; hint?: string; loading?: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="truncate text-2xl font-bold tracking-tight">{loading ? <span className="inline-block h-7 w-20 animate-pulse rounded bg-muted align-middle" /> : value}</div>
          {hint && <div className="truncate text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

const SOURCE_LABEL = { ai_extraction: 'AI extraction', calculator: 'Calculator', upload: 'Spreadsheet' } as const;

export function UserDashboard() {
  const { user, profile } = useAuth();
  const inventories = useInventories();
  const certificates = useCertificates();
  const orders = useOrders();
  const wallet = useWalletStatus();
  const audits = useMyAudits(user?.id);
  const retirements = useMyRetirements(user?.id);

  const latest = inventories.data?.[0];
  const certifiedIds = new Set((certificates.data ?? []).map((c) => c.emission_data_id));
  const auditedIds = new Set((audits.data ?? []).map((a) => a.emission_data_id));
  const tonnesNeeded = (certificates.data ?? []).reduce((sum, c) => sum + Math.ceil(Number(c.total_emissions) / 1000), 0);
  const tonnesRetired = (certificates.data ?? []).reduce((sum, c) => sum + c.offset_tonnes, 0);
  const fulfilledTonnes = (orders.data ?? []).filter((o) => o.status === 'fulfilled').reduce((sum, o) => sum + o.quantity, 0);

  const breakdown = useMemo(
    () =>
      Object.entries(latest?.breakdown ?? {})
        .map(([name, kg]) => ({ name, tonnes: Math.round((Number(kg) / 1000) * 100) / 100 }))
        .sort((a, b) => b.tonnes - a.tonnes),
    [latest],
  );

  const steps = [
    { done: Boolean(profile?.wallet_address), label: 'Link your wallet', href: null, hint: 'Account menu, top right' },
    { done: (inventories.data?.length ?? 0) > 0, label: 'Measure your emissions', href: '/upload', hint: 'Upload bills or use the calculator' },
    { done: auditedIds.size > 0, label: 'Run the AI audit', href: latest ? `/inventories/${latest.id}` : '/inventories', hint: 'Catches double counting and unit slips' },
    { done: (certificates.data?.length ?? 0) > 0, label: 'Issue a certificate', href: latest ? `/inventories/${latest.id}` : '/inventories', hint: 'NFT plus Hedera consensus record' },
    { done: fulfilledTonnes > 0, label: 'Buy carbon credits', href: '/marketplace', hint: 'Paid in HBAR, AI-rated projects' },
    { done: tonnesRetired > 0, label: 'Retire credits against a certificate', href: '/certificates', hint: 'Destroys the tokens on chain' },
  ];
  const completed = steps.filter((s) => s.done).length;
  const loading = inventories.isLoading || certificates.isLoading;

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back{profile?.display_name ? `, ${profile.display_name}` : ''}</h1>
          <p className="text-muted-foreground">{profile?.organization ?? 'Your carbon accounting at a glance.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/upload">
              <Upload className="mr-2 h-4 w-4" /> Add data
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/reduce">
              <TrendingDown className="mr-2 h-4 w-4" /> Plan reductions
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Leaf}
          label="Latest inventory"
          value={latest ? formatTonnes(Number(latest.total_emissions)) : 'None yet'}
          hint={latest ? `${latest.organization ?? ''} - ${SOURCE_LABEL[latest.source]}` : 'Add your first data'}
          loading={inventories.isLoading}
        />
        <Kpi icon={Award} label="Certificates" value={String(certificates.data?.length ?? 0)} hint={`${tonnesNeeded.toLocaleString()} t CO2e certified`} loading={certificates.isLoading} />
        <Kpi
          icon={CheckCircle2}
          label="Offset progress"
          value={tonnesNeeded ? `${Math.round((tonnesRetired / tonnesNeeded) * 100)}%` : '-'}
          hint={`${tonnesRetired.toLocaleString()} of ${tonnesNeeded.toLocaleString()} t retired`}
          loading={loading}
        />
        <Kpi
          icon={Wallet}
          label="Credits in wallet"
          value={wallet.data ? `${wallet.data.co2e.toLocaleString()} t` : profile?.wallet_address ? '...' : 'No wallet'}
          hint={wallet.data ? `${wallet.data.hbar.toLocaleString(undefined, { maximumFractionDigits: 2 })} HBAR` : 'Link MetaMask to trade'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Next steps</CardTitle>
            <CardDescription>
              {completed} of {steps.length} complete
            </CardDescription>
            <Progress value={(completed / steps.length) * 100} className="h-2" />
          </CardHeader>
          <CardContent className="space-y-1">
            {steps.map((step) => {
              const content = (
                <>
                  {step.done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0">
                    <span className={cn('block text-sm font-medium', step.done && 'text-muted-foreground line-through')}>{step.label}</span>
                    <span className="block text-xs text-muted-foreground">{step.hint}</span>
                  </span>
                </>
              );
              return step.href && !step.done ? (
                <Link key={step.label} href={step.href} className="flex items-start gap-3 rounded-md p-2 hover:bg-muted">
                  {content}
                </Link>
              ) : (
                <div key={step.label} className="flex items-start gap-3 p-2">
                  {content}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Emissions by source</CardTitle>
            <CardDescription>
              {latest
                ? `${latest.organization ?? 'Latest inventory'}${latest.reporting_period_start ? `, ${latest.reporting_period_start} to ${latest.reporting_period_end ?? ''}` : ''}`
                : 'Your latest inventory will appear here.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {breakdown.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={breakdown} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                    <XAxis type="number" tickFormatter={(v: number) => `${v} t`} fontSize={12} />
                    <YAxis type="category" dataKey="name" width={150} fontSize={12} />
                    <Tooltip formatter={(v: number) => [`${v.toLocaleString()} t CO2e`, 'Emissions']} />
                    <Bar dataKey="tonnes" fill="#16a34a" radius={[0, 4, 4, 0]} isAnimationActive={false} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                <FileText className="h-8 w-8" />
                No inventory yet.
                <Button asChild size="sm">
                  <Link href="/upload">Upload bills</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Inventories</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/inventories">
                All <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="divide-y">
            {(inventories.data ?? []).slice(0, 5).map((inv) => (
              <Link key={inv.id} href={`/inventories/${inv.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-primary">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{inv.organization ?? inv.file_name ?? 'Inventory'}</div>
                  <div className="text-xs text-muted-foreground">
                    {SOURCE_LABEL[inv.source]} - {format(new Date(inv.created_at), 'd MMM yyyy')}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold">{formatTonnes(Number(inv.total_emissions))}</span>
                  {certifiedIds.has(inv.id) ? (
                    <Badge className="bg-emerald-600">Certified</Badge>
                  ) : auditedIds.has(inv.id) ? (
                    <Badge variant="secondary">Audited</Badge>
                  ) : (
                    <Badge variant="outline">Draft</Badge>
                  )}
                </div>
              </Link>
            ))}
            {!inventories.isLoading && !inventories.data?.length && <p className="py-6 text-center text-sm text-muted-foreground">No inventories yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>On-chain activity</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/marketplace">
                Marketplace <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="divide-y">
            {[
              ...(certificates.data ?? []).map((c) => ({
                id: c.id,
                at: c.created_at,
                icon: Award,
                title: `Certificate ${c.certificate_id}`,
                detail: formatTonnes(Number(c.total_emissions)),
                href: `/certificates/${c.certificate_id}`,
              })),
              ...(orders.data ?? [])
                .filter((o) => o.status === 'fulfilled')
                .map((o) => ({ id: o.id, at: o.created_at, icon: ShoppingCart, title: `Bought ${o.quantity} t of credits`, detail: `${Number(o.unit_price_hbar) * o.quantity} HBAR`, href: '/marketplace' })),
              ...(retirements.data ?? [])
                .filter((r) => r.status === 'completed')
                .map((r) => ({ id: r.id, at: r.created_at, icon: CheckCircle2, title: `Retired ${r.amount} t`, detail: 'Tokens destroyed on chain', href: '/certificates' })),
            ]
              .sort((a, b) => b.at.localeCompare(a.at))
              .slice(0, 6)
              .map(({ id, at, icon: Icon, title, detail, href }) => (
                <Link key={id} href={href} className="flex items-center gap-3 py-3 hover:text-primary">
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{title}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(at), 'd MMM yyyy, HH:mm')}</div>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">{detail}</span>
                </Link>
              ))}
            {!loading && !certificates.data?.length && !orders.data?.length && (
              <p className="py-6 text-center text-sm text-muted-foreground">Certificates, purchases and retirements will show up here.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
