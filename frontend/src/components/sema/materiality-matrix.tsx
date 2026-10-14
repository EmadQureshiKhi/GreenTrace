'use client';

import { AlertCircle, Grid3X3, Target, TrendingUp } from 'lucide-react';
import { CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSema } from './sema-context';
import { EmptyState, ModuleSkeleton, StatCard } from './sema-shared';
import {
  EXTERNAL_MATERIALITY_THRESHOLD,
  INTERNAL_MATERIALITY_THRESHOLD,
  categoryBadgeClass,
  isPriority,
  mergeTopics,
  type MergedTopic,
  type TopicCategory,
} from './sema-types';

const CATEGORY_COLORS: Record<TopicCategory, string> = {
  Economic: '#0284c7',
  Environmental: '#059669',
  Social: '#7c3aed',
};

interface Point {
  x: number;
  y: number;
  topic: MergedTopic;
}

function PointTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const { topic } = payload[0].payload;
  return (
    <div className="max-w-[220px] rounded-md border bg-popover p-3 text-xs text-popover-foreground shadow-md">
      <p className="mb-1.5 text-sm font-semibold">{topic.name}</p>
      <p>
        External: {topic.external === null ? 'no responses' : `${topic.external.toFixed(1)} / 10`}
      </p>
      <p>Internal: {topic.internal === null ? 'not assessed' : `${topic.internal} / 25`}</p>
      <p className="mt-1 text-muted-foreground">
        {topic.category}
        {topic.externalMaterial || topic.internalMaterial ? ', material' : ''}
      </p>
    </div>
  );
}

function MaterialDot(props: { cx?: number; cy?: number; payload?: Point }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  const material = payload.topic.externalMaterial || payload.topic.internalMaterial;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={material ? 7 : 6}
      fill={CATEGORY_COLORS[payload.topic.category]}
      fillOpacity={material ? 0.95 : 0.45}
      stroke={material ? 'hsl(var(--foreground))' : 'none'}
      strokeWidth={1.5}
    />
  );
}

export default function MaterialityMatrix() {
  const { activeClient, isLoading, materialTopics, internalTopics } = useSema();

  if (isLoading) return <ModuleSkeleton rows={2} />;
  if (!activeClient) {
    return (
      <Card>
        <EmptyState icon={Grid3X3} title="No organization selected">
          Select an organization to see its materiality matrix.
        </EmptyState>
      </Card>
    );
  }

  const merged = mergeTopics(materialTopics, internalTopics);
  const materialCount = merged.filter((t) => t.externalMaterial || t.internalMaterial).length;
  const priorityCount = merged.filter(isPriority).length;
  const bothCount = merged.filter((t) => t.source === 'both').length;
  const points: Point[] = merged
    .filter((t) => t.external !== null || t.internal !== null)
    .map((t) => ({ x: t.external ?? 0, y: t.internal ?? 0, topic: t }));
  const ranked = [...merged].sort((a, b) => (b.external ?? 0) / 10 + (b.internal ?? 0) / 25 - ((a.external ?? 0) / 10 + (a.internal ?? 0) / 25));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Topics" value={merged.length} icon={Grid3X3} iconClassName="text-sky-600" />
        <StatCard label="Material" value={materialCount} hint="Either threshold met" icon={Target} iconClassName="text-emerald-600" />
        <StatCard label="Priority" value={priorityCount} hint="Both thresholds met" icon={TrendingUp} iconClassName="text-violet-600" />
        <StatCard label="Assessed both ways" value={bothCount} hint="Matched by topic name" icon={AlertCircle} iconClassName="text-orange-600" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Materiality matrix</CardTitle>
              <CardDescription>External importance (stakeholders) against internal impact (business)</CardDescription>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {(Object.keys(CATEGORY_COLORS) as TopicCategory[]).map((c) => (
                <span key={c} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c] }} />
                  {c}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border-[1.5px] border-foreground bg-muted-foreground" />
                Material
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {points.length === 0 ? (
            <EmptyState icon={Grid3X3} title="Nothing to plot yet">
              Record stakeholder responses in the Questionnaire Engine and rate topics in the Internal Assessment to build the matrix.
            </EmptyState>
          ) : (
            <>
              <div className="h-80 w-full sm:h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 12, right: 12, bottom: 28, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <ReferenceArea
                      x1={EXTERNAL_MATERIALITY_THRESHOLD}
                      x2={10}
                      y1={INTERNAL_MATERIALITY_THRESHOLD}
                      y2={25}
                      fill="#10b981"
                      fillOpacity={0.08}
                      ifOverflow="hidden"
                    />
                    <ReferenceLine x={EXTERNAL_MATERIALITY_THRESHOLD} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                    <ReferenceLine y={INTERNAL_MATERIALITY_THRESHOLD} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      domain={[0, 10]}
                      ticks={[0, 2, 4, 6, 8, 10]}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      label={{ value: 'External importance (0-10)', position: 'bottom', offset: 10, fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      domain={[0, 25]}
                      ticks={[0, 5, 10, 15, 20, 25]}
                      width={44}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      label={{ value: 'Internal impact', angle: -90, position: 'insideLeft', offset: 12, fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <ZAxis range={[80, 80]} />
                    <Tooltip content={<PointTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter data={points} shape={<MaterialDot />} isAnimationActive={false} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                The shaded area is the priority quadrant. Dashed lines are the materiality thresholds ({EXTERNAL_MATERIALITY_THRESHOLD} external,{' '}
                {INTERNAL_MATERIALITY_THRESHOLD} internal). Topics assessed only one way sit on an axis.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Topic analysis</CardTitle>
          <CardDescription>All topics with their scores and materiality</CardDescription>
        </CardHeader>
        <CardContent>
          {merged.length === 0 ? (
            <EmptyState icon={Grid3X3} title="No topics yet">
              Add topics in the Questionnaire Engine and the Internal Assessment.
            </EmptyState>
          ) : (
            <div className="-mx-6 overflow-x-auto px-6">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2 font-medium">Topic</th>
                    <th className="p-2 font-medium">Category</th>
                    <th className="p-2 text-center font-medium">External</th>
                    <th className="p-2 text-center font-medium">Internal</th>
                    <th className="p-2 text-center font-medium">Assessed</th>
                    <th className="p-2 text-center font-medium">Material</th>
                    <th className="p-2 text-center font-medium">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((t) => (
                    <tr key={t.key} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="p-2 font-medium">{t.name}</td>
                      <td className="p-2">
                        <Badge variant="outline" className={categoryBadgeClass(t.category)}>
                          {t.category}
                        </Badge>
                      </td>
                      <td className="p-2 text-center tabular-nums">
                        {t.external === null ? (
                          <span className="text-muted-foreground">n/a</span>
                        ) : (
                          <span className={t.externalMaterial ? 'font-bold text-emerald-600 dark:text-emerald-400' : ''}>{t.external.toFixed(1)}/10</span>
                        )}
                      </td>
                      <td className="p-2 text-center tabular-nums">
                        {t.internal === null ? (
                          <span className="text-muted-foreground">n/a</span>
                        ) : (
                          <span className={t.internalMaterial ? 'font-bold text-emerald-600 dark:text-emerald-400' : ''}>{t.internal}/25</span>
                        )}
                      </td>
                      <td className="p-2 text-center capitalize">{t.source}</td>
                      <td className="p-2 text-center">
                        {t.externalMaterial || t.internalMaterial ? (
                          <Badge className="border-transparent bg-emerald-600 text-white hover:bg-emerald-600">Yes</Badge>
                        ) : (
                          <Badge variant="outline">No</Badge>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {isPriority(t) ? (
                          <Badge className="border-transparent bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-200">High</Badge>
                        ) : (
                          <Badge variant="outline">Standard</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Method</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                title: 'External importance',
                text: `The average of stakeholder questionnaire scores (1-10). Topics averaging ${EXTERNAL_MATERIALITY_THRESHOLD} or more are externally material.`,
              },
              {
                title: 'Internal impact',
                text: `Severity x likelihood from the internal assessment (1-25). Topics at ${INTERNAL_MATERIALITY_THRESHOLD} or more are internally material.`,
              },
              {
                title: 'Quadrants',
                text: 'High-high: act now. High external only: monitor stakeholder concern. High internal only: manage business risk. Low-low: minimal attention.',
              },
              {
                title: 'Materiality',
                text: 'A topic is material when it meets either threshold; topics meeting both are priorities. Topics are matched across assessments by name.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border bg-muted/30 p-4">
                <h4 className="mb-1 font-semibold">{item.title}</h4>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
