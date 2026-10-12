'use client';

import { AlertCircle, ArrowRight, Award, Calculator, Calendar, FileUp, Hexagon, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useCertificates } from '@/hooks/use-api';
import { errorMessage, formatKg, formatTonnes } from '@/lib/format';
import type { Certificate } from '@/lib/types';
import { CertificateStatusBadge } from './certificate-badges';
import { certifiedTonnes, formatDate, offsetPercent, verificationPath } from './certificate-utils';

export function CertificateList() {
  const { data: certificates, isLoading, isError, error, refetch, isFetching } = useCertificates();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Certificates</h1>
          <p className="text-muted-foreground">
            Emissions certificates issued from your audited inventories, each minted as an NFT and anchored on Hedera.
          </p>
        </div>
        {certificates && certificates.length > 0 && (
          <Button asChild variant="outline" className="shrink-0">
            <Link href="/inventories">
              <Calculator className="mr-2 h-4 w-4" /> Inventories
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load your certificates</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{errorMessage(error)}</p>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : !certificates || certificates.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {certificates.map((certificate) => (
            <CertificateCard key={certificate.id} certificate={certificate} />
          ))}
        </div>
      )}
    </div>
  );
}

function CertificateCard({ certificate }: { certificate: Certificate }) {
  const needed = certifiedTonnes(certificate);
  const offset = Number(certificate.offset_tonnes);
  const kg = Number(certificate.total_emissions);

  return (
    <Link href={verificationPath(certificate.certificate_id)} className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <Card className="flex h-full flex-col transition-colors group-hover:border-primary/50 group-hover:shadow-md">
        <CardContent className="flex flex-1 flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
              <Award className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
            </div>
            <CertificateStatusBadge status={certificate.status} />
          </div>

          <div className="min-w-0 space-y-1">
            <h2 className="line-clamp-2 break-words font-semibold leading-snug">{certificate.title}</h2>
            {certificate.organization && <p className="truncate text-sm text-muted-foreground">{certificate.organization}</p>}
            <p className="font-mono text-xs text-muted-foreground">{certificate.certificate_id}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Total emissions</dt>
              <dd className="truncate font-semibold" title={formatKg(kg)}>
                {formatTonnes(kg)} CO2e
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Issued</dt>
              <dd className="flex items-center gap-1 truncate">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {formatDate(certificate.issue_date)}
              </dd>
            </div>
          </dl>

          <div className="mt-auto space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Offset</span>
              <span className="font-medium tabular-nums">
                {offset.toLocaleString()} / {needed.toLocaleString()} t
              </span>
            </div>
            <Progress value={offsetPercent(certificate)} className="h-2" aria-label="Offset progress" />
          </div>

          <div className="flex items-center justify-between border-t pt-3 text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Hexagon className="h-3.5 w-3.5" />
              {certificate.nft_serial ? `NFT #${certificate.nft_serial}` : 'NFT pending'}
            </span>
            <span className="flex items-center gap-1 font-medium text-primary">
              View certificate <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Award className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">No certificates yet</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Build an emissions inventory, run the AI audit, then issue a certificate. It is minted as an NFT and recorded on Hedera so anyone can
            verify it.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/inventories">
              <Calculator className="mr-2 h-4 w-4" /> Go to inventories
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/upload">
              <FileUp className="mr-2 h-4 w-4" /> Upload documents
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading certificates">
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardContent className="space-y-4 p-5">
            <div className="flex justify-between">
              <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="h-9 animate-pulse rounded bg-muted" />
              <div className="h-9 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-2 animate-pulse rounded-full bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
