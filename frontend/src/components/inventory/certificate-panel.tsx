'use client';

import { AlertCircle, ArrowRight, Award, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConsensusProof } from '@/components/chain/consensus-proof';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIssueCertificate } from '@/hooks/use-api';
import { toast } from '@/hooks/use-toast';
import { errorMessage, formatTonnes } from '@/lib/format';
import type { AiAudit, Certificate, EmissionData } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDate, isAuditCurrent } from './inventory-utils';

interface CertificatePanelProps {
  inventory: EmissionData;
  certificate: Certificate | null | undefined;
  loading: boolean;
  latestAudit: AiAudit | undefined;
  hasLines: boolean;
}

export function CertificatePanel({ inventory, certificate, loading, latestAudit, hasLines }: CertificatePanelProps) {
  const router = useRouter();
  const issue = useIssueCertificate();
  const [title, setTitle] = useState('');

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="h-20 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (certificate) {
    return (
      <Card className="border-emerald-300 dark:border-emerald-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Award className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Certified
          </CardTitle>
          <CardDescription>This inventory is locked. Its hash is recorded in the certificate NFT metadata.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Certificate</dt>
              <dd className="font-mono font-medium">{certificate.certificate_id}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Issued</dt>
              <dd>{formatDate(certificate.issue_date)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="tabular-nums">{formatTonnes(Number(certificate.total_emissions))} CO2e</dd>
            </div>
          </dl>
          <p className="break-words text-sm font-medium">{certificate.title}</p>
          <ConsensusProof sequence={certificate.hcs_sequence} label="Issuance on Hedera" />
          <Button asChild className="w-full">
            <Link href={`/certificates/${certificate.certificate_id}`}>
              View certificate
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const audited = Boolean(latestAudit && isAuditCurrent(latestAudit, inventory));
  const notHigh = Boolean(latestAudit && audited && latestAudit.risk_level !== 'high');
  const trimmed = title.trim();
  const titleInvalid = trimmed.length > 0 && (trimmed.length < 3 || trimmed.length > 140);
  const ready = hasLines && audited && notHigh && !titleInvalid;

  const requirements = [
    { ok: hasLines, label: 'The inventory has activity lines' },
    { ok: audited, label: latestAudit ? (audited ? 'Audit run on the current contents' : 'Audit is out of date: re-run it') : 'Run the AI audit' },
    { ok: notHigh, label: latestAudit?.risk_level === 'high' && audited ? 'Audit risk is high: resolve the findings' : 'Audit risk is low or medium' },
  ];

  const submit = () => {
    issue.mutate(
      { emissionDataId: inventory.id, title: trimmed || undefined },
      {
        onSuccess: (cert) => {
          toast({ title: 'Certificate issued', description: `${cert.certificate_id} was minted and logged on Hedera.` });
          router.push(`/certificates/${cert.certificate_id}`);
        },
        onError: (error) => toast({ variant: 'destructive', title: 'Could not issue the certificate', description: errorMessage(error) }),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Award className="h-5 w-5 text-primary" />
          Issue certificate
        </CardTitle>
        <CardDescription>
          Issuing hashes the inventory, stores its metadata by content address, mints a certificate NFT and logs it to Hedera Consensus Service. The inventory cannot change afterwards.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1.5">
          {requirements.map((r) => (
            <li key={r.label} className="flex items-start gap-2 text-sm">
              {r.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className={cn(!r.ok && 'text-muted-foreground')}>{r.label}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-2">
          <Label htmlFor="certificate-title">Title (optional)</Label>
          <Input
            id="certificate-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`${inventory.organization || 'Organization'} GHG emissions certificate`}
            maxLength={140}
            className={cn(titleInvalid && 'border-red-500')}
          />
          {titleInvalid && <p className="text-xs text-red-600 dark:text-red-400">Use 3 to 140 characters.</p>}
        </div>
        {issue.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage(issue.error)}</AlertDescription>
          </Alert>
        )}
        <Button onClick={submit} disabled={!ready || issue.isPending} className="w-full">
          {issue.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Award className="mr-2 h-4 w-4" />}
          {issue.isPending ? 'Issuing on Hedera...' : 'Issue certificate'}
        </Button>
      </CardContent>
    </Card>
  );
}
