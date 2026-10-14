'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle, Edit, Grid3X3, Loader2, Plus, Target, Trash2, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HcsTransactionDisplay } from '@/components/ui/hcs-transaction-display';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useSema } from './sema-context';
import { ConfirmDialog, EmptyState, ModuleSkeleton, ScoreSelect, StatCard } from './sema-shared';
import { runWithToast } from './sema-utils';
import {
  INTERNAL_MATERIALITY_THRESHOLD,
  categoryBadgeClass,
  internalSignificance,
  type InternalTopicInput,
  type SemaInternalTopic,
  type TopicCategory,
} from './sema-types';

const EMPTY_FORM: InternalTopicInput = { name: '', description: '', category: 'Environmental', severity: 3, likelihood: 3 };

function riskTone(significance: number): string {
  if (significance >= 20) return 'border-red-300 bg-red-100 dark:border-red-900 dark:bg-red-950/70';
  if (significance >= 15) return 'border-orange-300 bg-orange-100 dark:border-orange-900 dark:bg-orange-950/70';
  if (significance >= INTERNAL_MATERIALITY_THRESHOLD) return 'border-amber-300 bg-amber-100 dark:border-amber-900 dark:bg-amber-950/70';
  return 'border-border bg-muted/40';
}

function significanceText(significance: number): string {
  if (significance >= 15) return 'text-red-600 dark:text-red-400';
  if (significance >= INTERNAL_MATERIALITY_THRESHOLD) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function TopicForm({ editing, onDone }: { editing: SemaInternalTopic | null; onDone: () => void }) {
  const { addInternalTopic, updateInternalTopic } = useSema();
  const [form, setForm] = useState<InternalTopicInput>(
    editing
      ? { name: editing.name, description: editing.description ?? '', category: editing.category, severity: editing.severity, likelihood: editing.likelihood }
      : EMPTY_FORM,
  );
  const [isSaving, setIsSaving] = useState(false);
  const preview = internalSignificance(form.severity, form.likelihood);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const ok = editing
      ? await runWithToast(() => updateInternalTopic(editing.id, form), { title: 'Topic updated', description: form.name })
      : await runWithToast(() => addInternalTopic(form), { title: 'Topic added', description: form.name });
    setIsSaving(false);
    if (ok) onDone();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editing ? 'Edit internal topic' : 'Add internal topic'}</CardTitle>
        <CardDescription>Rate the business impact of a sustainability topic</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="internal-name">Topic</Label>
              <Input
                id="internal-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Regulatory compliance"
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="internal-category">Category</Label>
              <Select value={form.category} onValueChange={(v: TopicCategory) => setForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger id="internal-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Economic">Economic</SelectItem>
                  <SelectItem value="Environmental">Environmental</SelectItem>
                  <SelectItem value="Social">Social</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="internal-description">Description</Label>
            <Input
              id="internal-description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="The risk or opportunity for the business"
              maxLength={500}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ScoreSelect
              id="internal-severity"
              label="Severity"
              value={form.severity}
              onChange={(v) => setForm((p) => ({ ...p, severity: v }))}
              help="How severe would the impact be if it materialized?"
            />
            <ScoreSelect
              id="internal-likelihood"
              label="Likelihood"
              value={form.likelihood}
              onChange={(v) => setForm((p) => ({ ...p, likelihood: v }))}
              help="How likely is it to occur or become an issue?"
            />
          </div>
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm font-medium">
              Significance: <span className={cn('tabular-nums', significanceText(preview.significance))}>{preview.significance}</span> / 25,{' '}
              {preview.is_material ? 'material' : 'not material'}
            </p>
            <p className="text-xs text-muted-foreground">Severity x likelihood. Topics at {INTERNAL_MATERIALITY_THRESHOLD} or more are internally material.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isSaving || !form.name.trim()}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Add topic'}
            </Button>
            <Button type="button" variant="outline" onClick={onDone} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function RiskMatrix({ topics }: { topics: SemaInternalTopic[] }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 sm:gap-3">
        <div className="flex w-5 shrink-0 items-center justify-center">
          <span className="-rotate-90 whitespace-nowrap text-xs font-medium text-muted-foreground">Severity</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-[1.25rem_repeat(5,minmax(0,1fr))] gap-1 sm:gap-2">
            {[5, 4, 3, 2, 1].map((severity) => (
              <div key={severity} className="contents">
                <div className="flex items-center justify-center text-xs font-medium text-muted-foreground">{severity}</div>
                {[1, 2, 3, 4, 5].map((likelihood) => {
                  const significance = severity * likelihood;
                  const inCell = topics.filter((t) => t.severity === severity && t.likelihood === likelihood);
                  return (
                    <div
                      key={likelihood}
                      className={cn('flex min-h-14 flex-col items-center justify-center rounded-md border p-1 text-center sm:min-h-20 sm:p-2', riskTone(significance))}
                      title={inCell.map((t) => t.name).join(', ') || undefined}
                    >
                      <span className="text-sm font-bold tabular-nums sm:text-base">{significance}</span>
                      {inCell.length > 0 && (
                        <>
                          <span className="mt-0.5 rounded-full bg-foreground/80 px-1.5 text-[10px] font-semibold text-background sm:hidden">{inCell.length}</span>
                          <span className="hidden w-full space-y-0.5 sm:block">
                            {inCell.slice(0, 2).map((t) => (
                              <span key={t.id} className="block truncate text-[11px] leading-tight text-foreground/80">
                                {t.name}
                              </span>
                            ))}
                            {inCell.length > 2 && <span className="block text-[11px] text-muted-foreground">+{inCell.length - 2} more</span>}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            <div />
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="text-center text-xs font-medium text-muted-foreground">
                {n}
              </div>
            ))}
          </div>
          <p className="mt-1 text-center text-xs font-medium text-muted-foreground">Likelihood</p>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 border-t pt-4 text-xs sm:text-sm">
        {[
          { label: 'High (20+)', tone: riskTone(20) },
          { label: 'Medium-high (15-19)', tone: riskTone(15) },
          { label: `Medium (${INTERNAL_MATERIALITY_THRESHOLD}-14)`, tone: riskTone(INTERNAL_MATERIALITY_THRESHOLD) },
          { label: `Low (under ${INTERNAL_MATERIALITY_THRESHOLD})`, tone: riskTone(1) },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-2">
            <span className={cn('h-3.5 w-3.5 rounded border', item.tone)} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function InternalAssessment() {
  const { activeClient, isDemo, isLoading, internalTopics, latestInternalTopicHcsTx, deleteInternalTopic } = useSema();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SemaInternalTopic | null>(null);
  const [deleting, setDeleting] = useState<SemaInternalTopic | null>(null);

  if (isLoading) return <ModuleSkeleton />;
  if (!activeClient) {
    return (
      <Card>
        <EmptyState icon={Target} title="No organization selected">
          Select an organization to assess internal impact.
        </EmptyState>
      </Card>
    );
  }

  const materialCount = internalTopics.filter((t) => t.is_material).length;
  const averageSignificance = internalTopics.length > 0 ? internalTopics.reduce((sum, t) => sum + t.significance, 0) / internalTopics.length : 0;
  const highRisk = internalTopics.filter((t) => t.significance >= 15).length;
  const sorted = [...internalTopics].sort((a, b) => b.significance - a.significance);

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Topics" value={internalTopics.length} icon={Target} iconClassName="text-sky-600" />
        <StatCard label="Internally material" value={materialCount} hint={`Significance ${INTERNAL_MATERIALITY_THRESHOLD}+`} icon={TrendingUp} iconClassName="text-emerald-600" />
        <StatCard label="High risk" value={highRisk} hint="Significance 15+" icon={AlertTriangle} iconClassName="text-red-600" />
        <StatCard
          label="Average significance"
          value={internalTopics.length > 0 ? averageSignificance.toFixed(1) : 'None'}
          hint="out of 25"
          icon={Grid3X3}
          iconClassName="text-violet-600"
        />
      </div>

      {(formOpen || editing) && <TopicForm key={editing?.id ?? 'new'} editing={editing} onDone={closeForm} />}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Internal topics</CardTitle>
              <CardDescription>Business impact by severity and likelihood</CardDescription>
            </div>
            {!formOpen && !editing && !isDemo && (
              <Button onClick={() => setFormOpen(true)} className="self-start sm:self-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add topic
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {internalTopics.length === 0 ? (
            <EmptyState icon={Target} title="No internal topics yet">
              Add the topics that could affect the business, and rate their severity and likelihood.
            </EmptyState>
          ) : (
            <div className="-mx-6 overflow-x-auto px-6">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2 font-medium">Topic</th>
                    <th className="p-2 font-medium">Category</th>
                    <th className="p-2 text-center font-medium">Severity</th>
                    <th className="p-2 text-center font-medium">Likelihood</th>
                    <th className="p-2 text-center font-medium">Significance</th>
                    <th className="p-2 text-center font-medium">Material</th>
                    {!isDemo && <th className="p-2 text-right font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((topic) => (
                    <tr key={topic.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="p-2">
                        <p className="font-medium">{topic.name}</p>
                        {topic.description && <p className="text-xs text-muted-foreground">{topic.description}</p>}
                      </td>
                      <td className="p-2">
                        <Badge variant="outline" className={categoryBadgeClass(topic.category)}>
                          {topic.category}
                        </Badge>
                      </td>
                      <td className="p-2 text-center tabular-nums">{topic.severity}</td>
                      <td className="p-2 text-center tabular-nums">{topic.likelihood}</td>
                      <td className="p-2 text-center">
                        <span className={cn('font-bold tabular-nums', significanceText(topic.significance))}>{topic.significance}</span>
                      </td>
                      <td className="p-2 text-center">
                        {topic.is_material ? (
                          <Badge className="border-transparent bg-emerald-600 text-white hover:bg-emerald-600">Yes</Badge>
                        ) : (
                          <Badge variant="outline">No</Badge>
                        )}
                      </td>
                      {!isDemo && (
                        <td className="p-2">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${topic.name}`} onClick={() => setEditing(topic)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Delete ${topic.name}`} onClick={() => setDeleting(topic)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {!isDemo && (
        <HcsTransactionDisplay
          transaction={latestInternalTopicHcsTx}
          title="Internal assessment audit log"
          description="Latest internal topic change logged to Hedera Consensus Service"
        />
      )}

      {internalTopics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Risk matrix</CardTitle>
            <CardDescription>Topics placed by severity and likelihood</CardDescription>
          </CardHeader>
          <CardContent>
            <RiskMatrix topics={internalTopics} />
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'topic'}?`}
        description="The topic and its ratings are removed from the internal assessment."
        onConfirm={async () => {
          if (deleting) await deleteInternalTopic(deleting.id);
        }}
      />
    </div>
  );
}
