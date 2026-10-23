'use client';

import { ArrowRight, Award, FileSearch, Scale, Search, ShieldCheck, ShoppingCart, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePlatformStats } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { chainConfig, hashscanUrl } from '@/lib/chain-config';

const steps = [
  {
    icon: FileSearch,
    title: 'Measure',
    tag: 'AI',
    body: 'Drop in electricity, gas and fuel bills. The AI reads the quantities with page-level evidence; emissions are computed from a fixed factor catalog, never by the model.',
  },
  {
    icon: Scale,
    title: 'Audit',
    tag: 'AI + rules',
    body: 'Before anything is certified, rule checks and an AI auditor look for double-counted bills, overlapping periods, unit slips and implausible values.',
  },
  {
    icon: Award,
    title: 'Certify',
    tag: 'Hedera',
    body: 'The inventory is hashed, its metadata stored by content address, a certificate NFT minted and the record logged to Hedera Consensus Service.',
  },
  {
    icon: ShoppingCart,
    title: 'Offset',
    tag: 'Hedera',
    body: 'Buy AI-rated credits in HBAR and retire them against your certificate. Retired tokens are destroyed on chain, so no tonne can be claimed twice.',
  },
];

function Stat({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="rounded-xl border bg-background/70 p-4">
      <div className="text-2xl font-bold tracking-tight">
        {loading ? <span className="inline-block h-7 w-16 animate-pulse rounded bg-muted align-middle" /> : value}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

export function Landing() {
  const { openAuthModal } = useAuth();
  const { data: stats, isLoading, isError } = usePlatformStats();
  const router = useRouter();
  const [certificateId, setCertificateId] = useState('');

  const verify = (e: FormEvent) => {
    e.preventDefault();
    const id = certificateId.trim().toUpperCase();
    if (id) router.push(`/certificates/${encodeURIComponent(id)}`);
  };

  const fmt = (n: number, digits = 0) => n.toLocaleString(undefined, { maximumFractionDigits: digits });

  return (
    <div className="container mx-auto space-y-16 px-4 py-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-600 to-emerald-700 px-6 py-14 text-white sm:px-12">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-32 right-32 h-72 w-72 rounded-full bg-white/5" />
        <div className="relative max-w-3xl space-y-6">
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Carbon accounting you can verify, not just trust.</h1>
          <p className="text-lg text-green-50">
            GreenTrace turns bills into an audited greenhouse gas inventory with AI, certifies it on Hedera, and lets you buy and retire carbon credits on
            chain, with a public proof for every step.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" variant="secondary" onClick={openAuthModal} className="text-green-800">
              Get started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <Link href="/marketplace">Browse credits</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <p className="text-muted-foreground">AI does the reading and the reviewing. Hedera keeps the record. You stay in control of every value.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, tag, body }, i) => (
            <Card key={title}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <Badge variant="outline" className="gap-1">
                    {tag.startsWith('AI') && <Sparkles className="h-3 w-3" />}
                    {tag}
                  </Badge>
                </div>
                <h3 className="font-semibold">
                  {i + 1}. {title}
                </h3>
                <p className="text-sm text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <h2 className="text-2xl font-semibold tracking-tight">Live on Hedera {chainConfig.network}</h2>
          {isError ? (
            <p className="text-sm text-muted-foreground">Platform statistics are unavailable right now.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Certificates issued" value={fmt(stats?.certificates ?? 0)} loading={isLoading} />
              <Stat label="Tonnes CO2e certified" value={fmt(stats?.certifiedTonnes ?? 0, 1)} loading={isLoading} />
              <Stat label="Tonnes retired on chain" value={fmt(stats?.retiredTonnes ?? 0)} loading={isLoading} />
              <Stat label="Credits available (t)" value={fmt(stats?.creditsListed ?? 0)} loading={isLoading} />
            </div>
          )}
          {chainConfig.topicId && (
            <p className="text-sm text-muted-foreground">
              Every certificate, audit, purchase and retirement is a message on the public{' '}
              <a href={hashscanUrl('topic', chainConfig.topicId)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                GreenTrace audit topic
              </a>
              .
            </p>
          )}
        </div>

        <Card className="lg:col-span-2">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Verify a certificate</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Anyone can check a GreenTrace certificate. We recompute its hash and compare it with the record on Hedera, the NFT and the stored metadata.
            </p>
            <form onSubmit={verify} className="flex gap-2">
              <Input
                value={certificateId}
                onChange={(e) => setCertificateId(e.target.value)}
                placeholder="GT-2026-XXXXXX"
                aria-label="Certificate id"
                className="font-mono"
              />
              <Button type="submit" disabled={!certificateId.trim()}>
                <Search className="mr-2 h-4 w-4" /> Verify
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-2xl border bg-background/70 p-6 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight">Why Hedera</h2>
        <div className="mt-4 grid gap-6 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
          <p>
            <span className="font-medium text-foreground">A carbon-neutral ledger.</span> Hedera offsets its own footprint to run carbon negative, so
            recording climate data on it does not add to the problem it measures.
          </p>
          <p>
            <span className="font-medium text-foreground">An ordered, tamper-evident log.</span> Hedera Consensus Service timestamps and orders every audit
            record, so the history of a certificate cannot be rewritten.
          </p>
          <p>
            <span className="font-medium text-foreground">Native tokens with retirement built in.</span> Credits are Hedera tokens; retiring one removes it
            from supply, which is exactly what prevents double counting.
          </p>
          <p>
            <span className="font-medium text-foreground">Low, predictable fees.</span> Anchoring a record costs a fraction of a cent, so logging every
            step is practical, and the EVM lets any MetaMask wallet pay and sign.
          </p>
        </div>
      </section>
    </div>
  );
}
