'use client';

import { AlertCircle, BarChart3, CheckCircle, Clock, FileText, Target, TrendingUp, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HcsTransactionDisplay } from '@/components/ui/hcs-transaction-display';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useSema } from './sema-context';
import { EmptyState, ModuleSkeleton, StatCard } from './sema-shared';
import { mergeTopics, processSteps } from './sema-types';

type StepStatus = 'completed' | 'in-progress' | 'pending';

const STATUS_BADGE: Record<StepStatus, { label: string; className: string }> = {
  completed: { label: 'Complete', className: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  'in-progress': { label: 'In progress', className: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' },
  pending: { label: 'Not started', className: '' },
};

export default function SemaDashboard() {
  const {
    activeClient,
    stakeholders,
    sampleParameters,
    materialTopics,
    internalTopics,
    reports,
    isLoading,
    setActiveSemaModule,
    latestClientHcsTx,
    latestStakeholderHcsTx,
    latestSampleParamsHcsTx,
    latestMaterialTopicHcsTx,
    latestInternalTopicHcsTx,
    latestReportHcsTx,
  } = useSema();

  if (isLoading) return <ModuleSkeleton rows={2} />;
  if (!activeClient) {
    return (
      <Card>
        <EmptyState icon={BarChart3} title="No organization selected">
          Select an organization to see its SEMA progress.
        </EmptyState>
      </Card>
    );
  }

  const { steps, overall: overallProgress } = processSteps({ stakeholders, sampleParameters, materialTopics, internalTopics, reports });

  // A topic assessed both externally and internally is one topic (double materiality), counted once.
  const topics = mergeTopics(materialTopics, internalTopics);
  const materialCount = topics.filter((t) => t.externalMaterial || t.internalMaterial).length;
  const priorityStakeholders = stakeholders.filter((s) => s.is_priority).length;

  const latestTx = [latestClientHcsTx, latestStakeholderHcsTx, latestSampleParamsHcsTx, latestMaterialTopicHcsTx, latestInternalTopicHcsTx, latestReportHcsTx]
    .filter((tx) => tx !== null)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

  return (
    <div className="space-y-6">
      <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:border-green-900 dark:from-green-950/60 dark:to-emerald-950/60">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="break-words text-2xl text-green-900 dark:text-green-100">{activeClient.name}</CardTitle>
              <CardDescription className="text-green-800 dark:text-green-300">
                {[activeClient.industry, activeClient.size].filter(Boolean).join(' / ') || 'SEMA process overview'}
              </CardDescription>
            </div>
            <div className="sm:text-right">
              <div className="text-3xl font-bold tabular-nums text-green-900 dark:text-green-100">{overallProgress}%</div>
              <div className="text-sm text-green-800 dark:text-green-300">Overall progress</div>
            </div>
          </div>
          <Progress value={overallProgress} className="mt-4 h-2" />
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Stakeholders" value={stakeholders.length} hint={`${priorityStakeholders} priority`} icon={Users} iconClassName="text-sky-600" />
        <StatCard
          label="Sample size"
          value={sampleParameters?.base_sample_size ?? 'None'}
          hint={sampleParameters ? `${Math.round(sampleParameters.confidence_level * 100)}% confidence` : 'Not calculated'}
          icon={Target}
          iconClassName="text-violet-600"
        />
        <StatCard
          label="Material topics"
          value={materialCount}
          hint={`${topics.length} assessed`}
          icon={FileText}
          iconClassName="text-emerald-600"
        />
        <StatCard label="Reports" value={reports.length} hint={`${reports.filter((r) => r.status === 'final').length} final`} icon={TrendingUp} iconClassName="text-orange-600" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Process</CardTitle>
          <CardDescription>Each step of the materiality assessment, from your saved data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((step) => {
            const status: StepStatus = step.progress >= 100 ? 'completed' : step.progress > 0 ? 'in-progress' : 'pending';
            const StatusIcon = status === 'completed' ? CheckCircle : status === 'in-progress' ? Clock : AlertCircle;
            return (
              <button
                key={step.name}
                type="button"
                onClick={() => setActiveSemaModule(step.module)}
                className="flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <StatusIcon
                  className={cn(
                    'mt-0.5 h-5 w-5 shrink-0',
                    status === 'completed' ? 'text-emerald-600' : status === 'in-progress' ? 'text-amber-600' : 'text-muted-foreground',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-medium">{step.name}</h4>
                    <Badge variant="outline" className={STATUS_BADGE[status].className}>
                      {STATUS_BADGE[status].label}
                    </Badge>
                  </div>
                  <p className="mb-2 text-sm text-muted-foreground">{step.description}</p>
                  <Progress value={step.progress} className="h-1.5" />
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {latestTx && (
        <HcsTransactionDisplay transaction={latestTx} title="Latest Hedera log entry" description="The most recent SEMA change logged in this session" />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-sky-600" />
            How the assessment works
          </CardTitle>
          <CardDescription>Aligned with GRI 3: Material Topics 2021</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Users,
                title: 'Stakeholder engagement',
                text: 'Stakeholders are scored on dependency and influence across economic, social and environmental dimensions to decide who to engage.',
                tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
              },
              {
                icon: Target,
                title: 'Double materiality',
                text: 'External importance comes from stakeholder survey responses; internal impact from severity x likelihood ratings.',
                tone: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
              },
              {
                icon: FileText,
                title: 'GRI reporting',
                text: 'Material topics are mapped to GRI disclosures and can be drafted into report text with AI, then reviewed by you.',
                tone: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border bg-muted/30 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', item.tone)}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h4 className="font-semibold">{item.title}</h4>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
