'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, BarChart3, CheckCircle, Circle, Clock, Database, Download, FileSpreadsheet, FileText, Loader2, ShieldCheck, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HcsTransactionDisplay } from '@/components/ui/hcs-transaction-display';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { GriDrafter } from './gri-drafter';
import { useSema } from './sema-context';
import { EmptyState, ModuleSkeleton, StatCard } from './sema-shared';
import {
  EXTERNAL_MATERIALITY_THRESHOLD,
  INTERNAL_MATERIALITY_THRESHOLD,
  categoryBadgeClass,
  isPriority,
  mergeTopics,
  processSteps,
  type MergedTopic,
  type SemaReportTopic,
} from './sema-types';
import { downloadFile, runWithToast, slugify } from './sema-utils';

function rationale(t: MergedTopic): string {
  const parts: string[] = [];
  if (t.external !== null) {
    parts.push(
      `Stakeholders rated it ${t.external.toFixed(1)}/10 across ${t.responses} ${t.responses === 1 ? 'response' : 'responses'}` +
        (t.externalMaterial ? ` (threshold ${EXTERNAL_MATERIALITY_THRESHOLD})` : ', below the external threshold'),
    );
  }
  if (t.internal !== null) {
    parts.push(
      `internal significance is ${t.internal}/25` + (t.internalMaterial ? ` (threshold ${INTERNAL_MATERIALITY_THRESHOLD})` : ', below the internal threshold'),
    );
  }
  const text = parts.join('; ');
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}.` : 'Not yet scored.';
}

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function ScoreBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-muted">
          <div className={cn('h-2 rounded-full', tone)} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
        </div>
        <span className="w-12 text-right text-sm font-semibold tabular-nums">
          {Number.isInteger(value) ? value : value.toFixed(1)}/{max}
        </span>
      </div>
    </div>
  );
}

export default function ReportingDashboard() {
  const {
    activeClient,
    isDemo,
    isLoading,
    stakeholders,
    sampleParameters,
    materialTopics,
    internalTopics,
    questionnaireResponses,
    reports,
    latestReportHcsTx,
    finalizeReport,
    setActiveSemaModule,
  } = useSema();
  const [isFinalizing, setIsFinalizing] = useState(false);

  if (isLoading) return <ModuleSkeleton rows={3} />;
  if (!activeClient) {
    return (
      <Card>
        <EmptyState icon={FileText} title="No organization selected">
          Select an organization to prepare its report.
        </EmptyState>
      </Card>
    );
  }

  const merged = mergeTopics(materialTopics, internalTopics);
  // The same count the questionnaire shows: each topic's recorded responses.
  const responseCount = materialTopics.reduce((sum, t) => sum + t.response_count, 0);
  const finalTopics = merged
    .filter((t) => t.externalMaterial || t.internalMaterial)
    .sort((a, b) => Number(isPriority(b)) - Number(isPriority(a)) || (b.external ?? 0) / 10 + (b.internal ?? 0) / 25 - ((a.external ?? 0) / 10 + (a.internal ?? 0) / 25));
  const griMapped = finalTopics.filter((t) => t.griCode);
  const { steps, overall } = processSteps({ stakeholders, sampleParameters, materialTopics, internalTopics, reports });
  const priorityStakeholders = stakeholders.filter((s) => s.is_priority).length;

  const reportTopics: SemaReportTopic[] = finalTopics.map((t) => ({
    name: t.name,
    category: t.category,
    griCode: t.griCode,
    source: t.source,
    externalScore: t.external,
    responses: t.external === null ? null : t.responses,
    significance: t.internal,
  }));

  const checklist = [
    { label: 'Stakeholders identified and prioritized', done: stakeholders.length > 0 },
    { label: 'Survey sample size set', done: sampleParameters !== null },
    { label: 'Stakeholder responses recorded', done: responseCount > 0 },
    { label: 'Internal impact assessed', done: internalTopics.length > 0 },
    { label: 'Material topics determined', done: finalTopics.length > 0 },
    { label: 'Material topics mapped to GRI standards', done: finalTopics.length > 0 && griMapped.length === finalTopics.length },
    { label: 'Report finalized and logged to Hedera', done: reports.length > 0 },
  ];

  const handleFinalize = async () => {
    setIsFinalizing(true);
    await runWithToast(
      () =>
        finalizeReport({
          materialTopics: reportTopics,
          griDisclosures: griMapped.map((t) => ({ topic: t.name, griCode: t.griCode as string })),
          processSummary: {
            stakeholders: stakeholders.length,
            priorityStakeholders,
            responses: responseCount,
            topicsAssessed: merged.length,
            materialTopics: finalTopics.length,
            sampleParameters: sampleParameters
              ? {
                  confidenceLevel: sampleParameters.confidence_level,
                  marginOfError: sampleParameters.margin_error,
                  baseSampleSize: sampleParameters.base_sample_size,
                }
              : null,
            progress: Object.fromEntries(steps.map((s) => [s.module, s.progress])),
          },
        }),
      { title: 'Report finalized', description: 'Saved, and its hash is being logged to Hedera Consensus Service.' },
    );
    setIsFinalizing(false);
  };

  const exportBase = `sema-${slugify(activeClient.name)}-${new Date().toISOString().slice(0, 10)}`;

  const exportCsv = () => {
    const header = ['Topic', 'Category', 'GRI standard', 'Assessed', 'External score (0-10)', 'Responses', 'Internal significance (0-25)', 'Material', 'Priority'];
    const rows = merged.map((t) => [
      t.name,
      t.category,
      t.griCode,
      t.source,
      t.external === null ? null : t.external.toFixed(2),
      t.responses,
      t.internal,
      t.externalMaterial || t.internalMaterial ? 'yes' : 'no',
      isPriority(t) ? 'yes' : 'no',
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
    downloadFile(`${exportBase}-topics.csv`, `\uFEFF${csv}\n`, 'text/csv');
  };

  const exportJson = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      organization: { name: activeClient.name, industry: activeClient.industry, size: activeClient.size, description: activeClient.description },
      thresholds: { externalMateriality: EXTERNAL_MATERIALITY_THRESHOLD, internalMateriality: INTERNAL_MATERIALITY_THRESHOLD },
      stakeholders,
      sampleParameters,
      materialTopics,
      internalTopics,
      questionnaireResponses,
      finalMaterialTopics: reportTopics,
      reports,
    };
    downloadFile(`${exportBase}.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Material topics" value={finalTopics.length} hint={`of ${merged.length} assessed`} icon={Target} iconClassName="text-emerald-600" />
        <StatCard label="GRI mapped" value={griMapped.length} hint={`of ${finalTopics.length} material topics`} icon={FileText} iconClassName="text-sky-600" />
        <StatCard label="Process" value={`${overall}%`} hint="complete" icon={BarChart3} iconClassName="text-violet-600" />
        <StatCard label="Reports" value={reports.length} hint={reports[0] ? `latest ${format(new Date(reports[0].generated_at), 'PP')}` : 'none yet'} icon={Download} iconClassName="text-orange-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Process summary</CardTitle>
            <CardDescription>From the data saved for {activeClient.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((step) => (
              <button
                key={step.module}
                type="button"
                onClick={() => setActiveSemaModule(step.module)}
                className="block w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{step.name}</span>
                  <span className="text-sm font-semibold tabular-nums">{step.progress}%</span>
                </div>
                <Progress value={step.progress} className="h-1.5" />
                <p className="mt-1.5 text-xs text-muted-foreground">{step.description}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>GRI 3 checklist</CardTitle>
            <CardDescription>What the materiality process has covered so far</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-start gap-2.5 text-sm">
                  {item.done ? (
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={item.done ? '' : 'text-muted-foreground'}>{item.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t pt-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-orange-600" /> After the assessment
              </h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Validate the material topics with stakeholders</li>
                <li>Describe the management approach for each topic</li>
                <li>Set indicators and targets, then monitor them</li>
                <li>Prepare for external assurance</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-emerald-200 dark:border-emerald-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Finalize the report
          </CardTitle>
          <CardDescription>Saves a snapshot of the final material topics and logs its hash to Hedera Consensus Service</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-x-8 gap-y-2 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-2">
            {[
              ['Stakeholders', `${stakeholders.length} (${priorityStakeholders} priority)`],
              ['Stakeholder responses', responseCount],
              ['Material topics', finalTopics.length],
              ['GRI mapped', griMapped.length],
              ['Process complete', `${overall}%`],
              ['Assessment date', format(new Date(), 'PP')],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {isDemo ? (
            <p className="text-sm text-muted-foreground">The demo organization is read-only, so it cannot be finalized or logged.</p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button onClick={handleFinalize} disabled={isFinalizing || finalTopics.length === 0} className="self-start">
                {isFinalizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                {isFinalizing ? 'Saving and logging...' : 'Finalize and log to Hedera'}
              </Button>
              {finalTopics.length === 0 && <p className="text-sm text-muted-foreground">Determine at least one material topic first.</p>}
              {finalTopics.length > 0 && overall < 100 && (
                <p className="text-sm text-muted-foreground">Some steps are incomplete; the report records the process as it stands.</p>
              )}
            </div>
          )}
          {reports.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <h4 className="text-sm font-semibold">Saved reports</h4>
              {reports.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className="min-w-0 font-medium">{r.title}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {format(new Date(r.generated_at), 'PP p')}
                    <Badge variant="outline" className="capitalize">
                      {r.status}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!isDemo && (
        <HcsTransactionDisplay transaction={latestReportHcsTx} title="Report audit log" description="Finalized report logged to Hedera Consensus Service" />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            Final material topics
          </CardTitle>
          <CardDescription>Topics meeting the external or internal materiality threshold, priorities first</CardDescription>
        </CardHeader>
        <CardContent>
          {finalTopics.length === 0 ? (
            <EmptyState icon={AlertCircle} title="No material topics yet">
              Record stakeholder responses and rate internal impact; topics that meet a threshold appear here.
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {finalTopics.map((topic, index) => (
                <div key={topic.key} className="rounded-lg border p-4 sm:p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold">{topic.name}</h3>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge variant="outline" className={categoryBadgeClass(topic.category)}>
                            {topic.category}
                          </Badge>
                          {isPriority(topic) && (
                            <Badge className="border-transparent bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-200">Priority</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {topic.griCode && (
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">GRI</p>
                        <p className="font-mono font-semibold text-sky-700 dark:text-sky-300">{topic.griCode.replace('GRI ', '')}</p>
                      </div>
                    )}
                  </div>
                  <div className="mb-3 grid gap-4 md:grid-cols-2">
                    {topic.external !== null && <ScoreBar label="External importance" value={topic.external} max={10} tone="bg-sky-500" />}
                    {topic.internal !== null && <ScoreBar label="Internal significance" value={topic.internal} max={25} tone="bg-emerald-500" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{rationale(topic)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GRI mapping</CardTitle>
          <CardDescription>Material topics and the topic-specific GRI standard you assigned</CardDescription>
        </CardHeader>
        <CardContent>
          {finalTopics.length === 0 ? (
            <EmptyState icon={FileText} title="Nothing to map yet" />
          ) : (
            <div className="space-y-2">
              {finalTopics.map((t) => (
                <div key={t.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.category}</p>
                  </div>
                  {t.griCode ? (
                    <code className="rounded-md bg-sky-100 px-2.5 py-1 font-mono text-sm text-sky-800 dark:bg-sky-950 dark:text-sky-200">{t.griCode}</code>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setActiveSemaModule('questionnaire')}>
                      Assign a GRI standard
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <GriDrafter client={activeClient} isDemo={isDemo} hasTopics={materialTopics.length + internalTopics.length > 0} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-sky-600" />
            Export
          </CardTitle>
          <CardDescription>Download the assessment data as it is saved now</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Topics spreadsheet</h3>
                  <p className="text-sm text-muted-foreground">CSV, opens in Excel or Sheets</p>
                </div>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">Every assessed topic with its scores, materiality and GRI standard.</p>
              <Button variant="outline" className="w-full" onClick={exportCsv} disabled={merged.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Download CSV
              </Button>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600 text-white">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Full data</h3>
                  <p className="text-sm text-muted-foreground">JSON</p>
                </div>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">Stakeholders, sample parameters, topics, responses and reports.</p>
              <Button variant="outline" className="w-full" onClick={exportJson}>
                <Download className="mr-2 h-4 w-4" /> Download JSON
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
