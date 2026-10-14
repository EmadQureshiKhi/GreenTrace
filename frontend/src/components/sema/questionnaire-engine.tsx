'use client';

import { useState, type FormEvent } from 'react';
import { BarChart3, Edit, Loader2, MessageSquare, Plus, Star, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HcsTransactionDisplay } from '@/components/ui/hcs-transaction-display';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { useSema } from './sema-context';
import { ConfirmDialog, EmptyState, ModuleSkeleton, StatCard } from './sema-shared';
import { runWithToast } from './sema-utils';
import {
  EXTERNAL_MATERIALITY_THRESHOLD,
  categoryBadgeClass,
  type MaterialTopicInput,
  type ResponseInput,
  type SemaMaterialTopic,
  type SemaQuestionnaireResponse,
  type TopicCategory,
} from './sema-types';

const GRI_CODES = [
  'GRI 201', 'GRI 202', 'GRI 203', 'GRI 204', 'GRI 205', 'GRI 206', 'GRI 207',
  'GRI 301', 'GRI 302', 'GRI 303', 'GRI 304', 'GRI 305', 'GRI 306', 'GRI 308',
  'GRI 401', 'GRI 402', 'GRI 403', 'GRI 404', 'GRI 405', 'GRI 406', 'GRI 407', 'GRI 408',
  'GRI 409', 'GRI 410', 'GRI 411', 'GRI 413', 'GRI 414', 'GRI 415', 'GRI 416', 'GRI 417', 'GRI 418',
];
const NO_CODE = 'none';

const EMPTY_TOPIC: MaterialTopicInput = { name: '', description: '', category: 'Environmental', gri_code: '' };
const EMPTY_RESPONSE: ResponseInput = { topic_id: '', stakeholder_type: '', respondent_name: '', score: 0, comments: '' };

function scoreLabel(topic: SemaMaterialTopic): string {
  return topic.response_count > 0 ? `${topic.average_score.toFixed(1)} / 10` : 'No responses yet';
}

function TopicForm({ editing, onDone }: { editing: SemaMaterialTopic | null; onDone: () => void }) {
  const { addMaterialTopic, updateMaterialTopic } = useSema();
  const [form, setForm] = useState<MaterialTopicInput>(
    editing
      ? { name: editing.name, description: editing.description ?? '', category: editing.category, gri_code: editing.gri_code ?? '' }
      : EMPTY_TOPIC,
  );
  const [isSaving, setIsSaving] = useState(false);
  const codes = form.gri_code && !GRI_CODES.includes(form.gri_code) ? [form.gri_code, ...GRI_CODES] : GRI_CODES;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const ok = editing
      ? await runWithToast(() => updateMaterialTopic(editing.id, form), { title: 'Topic updated', description: form.name })
      : await runWithToast(() => addMaterialTopic(form), { title: 'Topic added', description: `Record stakeholder responses to score ${form.name}.` });
    setIsSaving(false);
    if (ok) onDone();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editing ? 'Edit topic' : 'Add topic'}</CardTitle>
        <CardDescription>A sustainability topic stakeholders will rate for importance</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="topic-name">Topic</Label>
              <Input
                id="topic-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. GHG emissions"
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic-category">Category</Label>
              <Select value={form.category} onValueChange={(v: TopicCategory) => setForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger id="topic-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Economic">Economic</SelectItem>
                  <SelectItem value="Environmental">Environmental</SelectItem>
                  <SelectItem value="Social">Social</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic-gri">GRI standard</Label>
              <Select value={form.gri_code || NO_CODE} onValueChange={(v) => setForm((p) => ({ ...p, gri_code: v === NO_CODE ? '' : v }))}>
                <SelectTrigger id="topic-gri">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CODE}>None</SelectItem>
                  {codes.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="topic-description">Description</Label>
            <Input
              id="topic-description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="What the topic covers"
              maxLength={500}
            />
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

function ResponseForm({ topics }: { topics: SemaMaterialTopic[] }) {
  const { stakeholders, addQuestionnaireResponse } = useSema();
  const [form, setForm] = useState<ResponseInput>({ ...EMPTY_RESPONSE, topic_id: topics[0]?.id ?? '' });
  const [isSaving, setIsSaving] = useState(false);
  const groups = Array.from(new Set(stakeholders.flatMap((s) => [s.name, s.stakeholder_type ?? '']).filter(Boolean)));
  // Fall back to the first topic if the selected one was deleted.
  const topicId = topics.some((t) => t.id === form.topic_id) ? form.topic_id : (topics[0]?.id ?? '');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const topic = topics.find((t) => t.id === topicId);
    const ok = await runWithToast(() => addQuestionnaireResponse({ ...form, topic_id: topicId }), {
      title: 'Response recorded',
      description: topic ? `${topic.name}: score ${form.score}` : undefined,
    });
    setIsSaving(false);
    // Keep the topic and group selected so a batch of survey results can be entered quickly.
    if (ok) setForm((p) => ({ ...p, respondent_name: '', score: 0, comments: '' }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="response-topic">Topic</Label>
          <Select value={topicId} onValueChange={(v) => setForm((p) => ({ ...p, topic_id: v }))}>
            <SelectTrigger id="response-topic">
              <SelectValue placeholder="Select a topic" />
            </SelectTrigger>
            <SelectContent>
              {topics.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="response-group">Stakeholder group</Label>
          <Input
            id="response-group"
            list="response-group-options"
            value={form.stakeholder_type}
            onChange={(e) => setForm((p) => ({ ...p, stakeholder_type: e.target.value }))}
            placeholder="e.g. Customers"
            required
            maxLength={100}
          />
          <datalist id="response-group-options">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Importance score</Label>
        <div role="radiogroup" aria-label="Importance score" className="grid grid-cols-5 gap-2 sm:flex sm:flex-wrap">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={form.score === score}
              onClick={() => setForm((p) => ({ ...p, score }))}
              className={cn(
                'h-10 rounded-md border text-sm font-semibold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-10',
                form.score === score ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
              )}
            >
              {score}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">1 = not important, 10 = critically important to this stakeholder.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="response-name">Respondent (optional)</Label>
          <Input
            id="response-name"
            value={form.respondent_name}
            onChange={(e) => setForm((p) => ({ ...p, respondent_name: e.target.value }))}
            placeholder="Name or reference"
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="response-comments">Comments (optional)</Label>
          <Input
            id="response-comments"
            value={form.comments}
            onChange={(e) => setForm((p) => ({ ...p, comments: e.target.value }))}
            placeholder="Why it matters to them"
            maxLength={1000}
          />
        </div>
      </div>

      <Button type="submit" disabled={isSaving || !topicId || !form.stakeholder_type.trim() || form.score < 1}>
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
        Record response
      </Button>
    </form>
  );
}

export default function QuestionnaireEngine() {
  const { activeClient, isDemo, isLoading, materialTopics, questionnaireResponses, latestMaterialTopicHcsTx, deleteMaterialTopic, deleteQuestionnaireResponse } =
    useSema();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SemaMaterialTopic | null>(null);
  const [deletingTopic, setDeletingTopic] = useState<SemaMaterialTopic | null>(null);
  const [deletingResponse, setDeletingResponse] = useState<SemaQuestionnaireResponse | null>(null);
  const [topicFilter, setTopicFilter] = useState('all');

  if (isLoading) return <ModuleSkeleton />;
  if (!activeClient) {
    return (
      <Card>
        <EmptyState icon={MessageSquare} title="No organization selected">
          Select an organization to run the stakeholder questionnaire.
        </EmptyState>
      </Card>
    );
  }

  const scored = materialTopics.filter((t) => t.response_count > 0);
  const materialCount = materialTopics.filter((t) => t.is_material).length;
  const totalResponses = materialTopics.reduce((sum, t) => sum + t.response_count, 0);
  const averageScore = scored.length > 0 ? scored.reduce((sum, t) => sum + t.average_score, 0) / scored.length : null;
  const topicName = new Map(materialTopics.map((t) => [t.id, t.name]));
  const visibleResponses = questionnaireResponses.filter((r) => topicFilter === 'all' || r.topic_id === topicFilter);

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Topics" value={materialTopics.length} icon={MessageSquare} iconClassName="text-sky-600" />
        <StatCard label="Externally material" value={materialCount} hint={`Average ${EXTERNAL_MATERIALITY_THRESHOLD}+ of 10`} icon={Star} iconClassName="text-emerald-600" />
        <StatCard label="Responses" value={totalResponses} icon={Users} iconClassName="text-violet-600" />
        <StatCard
          label="Average score"
          value={averageScore === null ? 'None' : averageScore.toFixed(1)}
          hint={averageScore === null ? 'No responses yet' : 'out of 10, scored topics'}
          icon={BarChart3}
          iconClassName="text-orange-600"
        />
      </div>

      {(formOpen || editing) && <TopicForm key={editing?.id ?? 'new'} editing={editing} onDone={closeForm} />}

      <Tabs defaultValue="topics" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="topics">Topics</TabsTrigger>
          <TabsTrigger value="responses">Responses</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        <TabsContent value="topics">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Topics</CardTitle>
                  <CardDescription>Scores are the average of the stakeholder responses you record</CardDescription>
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
              {materialTopics.length === 0 ? (
                <EmptyState icon={MessageSquare} title="No topics yet">
                  Add the sustainability topics you want stakeholders to rate, then record their responses.
                </EmptyState>
              ) : (
                <div className="space-y-3">
                  {materialTopics.map((topic) => (
                    <div key={topic.id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h4 className="font-medium">{topic.name}</h4>
                          <Badge variant="outline" className={categoryBadgeClass(topic.category)}>
                            {topic.category}
                          </Badge>
                          {topic.gri_code && <Badge variant="outline">{topic.gri_code}</Badge>}
                          {topic.is_material && (
                            <Badge className="border-transparent bg-emerald-600 text-white hover:bg-emerald-600">Material</Badge>
                          )}
                        </div>
                        {topic.description && <p className="text-sm text-muted-foreground">{topic.description}</p>}
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Score: {scoreLabel(topic)}</span>
                          <span>
                            {topic.response_count} {topic.response_count === 1 ? 'response' : 'responses'}
                          </span>
                        </div>
                      </div>
                      {!isDemo && (
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Edit ${topic.name}`} onClick={() => setEditing(topic)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`Delete ${topic.name}`} onClick={() => setDeletingTopic(topic)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="responses" className="space-y-4">
          {!isDemo && materialTopics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Record a response</CardTitle>
                <CardDescription>Enter each stakeholder survey answer; topic scores update automatically</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponseForm key={activeClient.id} topics={materialTopics} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Responses</CardTitle>
                  <CardDescription>
                    {isDemo ? 'A few sample responses; the demo topic scores are illustrative' : 'Every recorded stakeholder answer'}
                  </CardDescription>
                </div>
                {materialTopics.length > 0 && (
                  <Select value={topicFilter} onValueChange={setTopicFilter}>
                    <SelectTrigger className="w-full sm:w-56" aria-label="Filter by topic">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All topics</SelectItem>
                      {materialTopics.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {materialTopics.length === 0 ? (
                <EmptyState icon={Users} title="Add topics first">
                  Responses are recorded against topics. Add a topic on the Topics tab.
                </EmptyState>
              ) : visibleResponses.length === 0 ? (
                <EmptyState icon={Users} title="No responses yet">
                  Record survey answers above. A topic becomes externally material when its average reaches {EXTERNAL_MATERIALITY_THRESHOLD}.
                </EmptyState>
              ) : (
                <div className="divide-y">
                  {visibleResponses.map((r) => (
                    <div key={r.id} className="flex items-start gap-3 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold tabular-nums text-primary">
                        {r.score}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{topicName.get(r.topic_id) ?? 'Deleted topic'}</p>
                        <p className="text-xs text-muted-foreground">
                          {[r.stakeholder_type, r.respondent_name].filter(Boolean).join(' / ')} - {formatDate(r.created_at)}
                        </p>
                        {r.comments && <p className="mt-1 text-sm text-muted-foreground">{r.comments}</p>}
                      </div>
                      {!isDemo && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Delete response" onClick={() => setDeletingResponse(r)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking">
          <Card>
            <CardHeader>
              <CardTitle>Ranking</CardTitle>
              <CardDescription>Topics with an average of {EXTERNAL_MATERIALITY_THRESHOLD} or more are externally material</CardDescription>
            </CardHeader>
            <CardContent>
              {scored.length === 0 ? (
                <EmptyState icon={BarChart3} title="Nothing to rank yet">
                  Topics appear here once they have at least one response.
                </EmptyState>
              ) : (
                <div className="space-y-3">
                  {[...scored]
                    .sort((a, b) => b.average_score - a.average_score)
                    .map((topic) => (
                      <div key={topic.id} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                        <div className="min-w-0">
                          <h4 className="truncate font-medium">{topic.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {topic.category} / {topic.response_count} {topic.response_count === 1 ? 'response' : 'responses'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="hidden h-2 w-24 rounded-full bg-muted sm:block">
                            <div
                              className={cn('h-2 rounded-full', topic.is_material ? 'bg-emerald-500' : 'bg-muted-foreground/50')}
                              style={{ width: `${(topic.average_score / 10) * 100}%` }}
                            />
                          </div>
                          <span className="w-10 text-right font-bold tabular-nums">{topic.average_score.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {!isDemo && (
        <HcsTransactionDisplay
          transaction={latestMaterialTopicHcsTx}
          title="Questionnaire audit log"
          description="Latest topic or response change logged to Hedera Consensus Service"
        />
      )}

      <ConfirmDialog
        open={deletingTopic !== null}
        onOpenChange={(open) => !open && setDeletingTopic(null)}
        title={`Delete ${deletingTopic?.name ?? 'topic'}?`}
        description="The topic and all responses recorded for it are deleted."
        onConfirm={async () => {
          if (deletingTopic) await deleteMaterialTopic(deletingTopic.id);
        }}
      />
      <ConfirmDialog
        open={deletingResponse !== null}
        onOpenChange={(open) => !open && setDeletingResponse(null)}
        title="Delete this response?"
        description="The topic's average score is recalculated without it."
        onConfirm={async () => {
          if (deletingResponse) await deleteQuestionnaireResponse(deletingResponse);
        }}
      />
    </div>
  );
}
