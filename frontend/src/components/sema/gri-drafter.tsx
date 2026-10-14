'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, AlertTriangle, Check, Copy, Download, FileText, History, Loader2, LogIn, Sparkles } from 'lucide-react';
import { AiLabel } from '@/components/ai/ai-label';
import { AiUnavailable } from '@/components/ai/ai-unavailable';
import { ConsensusProof } from '@/components/chain/consensus-proof';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAiStatus } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { useGenerateGriDraft, useGriDrafts, type GriDraft } from '@/hooks/use-gri';
import { toast } from '@/hooks/use-toast';
import { errorMessage, shortHash } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MarkdownLite, countPlaceholders } from './markdown-lite';
import type { SemaClient } from './sema-types';
import { downloadFile, slugify } from './sema-utils';

function draftToMarkdown(draft: GriDraft, organization: string): string {
  const { content } = draft;
  const lines = [
    `# GRI disclosures draft: ${organization}`,
    '',
    `_AI-generated draft${draft.model ? ` (${draft.model})` : ''}, ${format(new Date(draft.created_at), 'PPP p')}. Draft hash ${draft.draft_hash}. Review every statement before publishing._`,
    '',
    '## Summary',
    '',
    content.summary,
    '',
  ];
  for (const d of content.disclosures) {
    lines.push(`## ${d.code}: ${d.title}`, '', d.content.trim(), '');
    if (d.sources.length) lines.push(`_Based on: ${d.sources.join('; ')}_`, '');
  }
  if (content.dataGaps.length) {
    lines.push('## Data gaps', '', ...content.dataGaps.map((g) => `- ${g}`), '');
  }
  return lines.join('\n');
}

function ElapsedProgress() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  // Asymptotic progress: honest about not knowing the exact finish, never claims to be done.
  const progress = Math.min(95, Math.round(100 * (1 - Math.exp(-seconds / 45))));
  return (
    <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/30" role="status">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
        Drafting disclosures from your assessment... {seconds}s
      </div>
      <Progress value={progress} className="h-1.5" />
      <p className="text-xs text-muted-foreground">This usually takes 30 to 90 seconds. You can keep working in other modules.</p>
    </div>
  );
}

function DraftView({ draft, organization }: { draft: GriDraft; organization: string }) {
  const [copied, setCopied] = useState(false);
  const { content } = draft;
  const placeholders = content.disclosures.reduce((sum, d) => sum + countPlaceholders(d.content), 0);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draftToMarkdown(draft, organization));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      toast({ title: 'Could not copy', description: errorMessage(error), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <AiLabel model={draft.model} text="AI draft" />
          <span>{format(new Date(draft.created_at), 'PPP p')}</span>
          <span className="font-mono" title={draft.draft_hash}>
            hash {shortHash(draft.draft_hash, 8, 6)}
          </span>
          <ConsensusProof sequence={draft.hcs_sequence} label="Draft hash on Hedera" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="mr-2 h-4 w-4 text-emerald-600" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? 'Copied' : 'Copy as Markdown'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadFile(`gri-draft-${slugify(organization)}-${draft.created_at.slice(0, 10)}.md`, draftToMarkdown(draft, organization), 'text/markdown')
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Download .md
          </Button>
        </div>
      </div>

      <div className="rounded-lg bg-muted/40 p-4">
        <h4 className="mb-1 text-sm font-semibold">Summary</h4>
        <p className="text-sm leading-relaxed text-foreground/90">{content.summary}</p>
        {placeholders > 0 && (
          <p className="mt-3 flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-300 dark:bg-amber-700" />
            {placeholders} {placeholders === 1 ? 'placeholder needs' : 'placeholders need'} data before this can be published
          </p>
        )}
      </div>

      <div className="space-y-4">
        {content.disclosures.map((d, i) => (
          <section key={`${d.code}-${i}`} className="rounded-lg border p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="border-transparent bg-sky-100 font-mono text-sky-800 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-200">{d.code}</Badge>
              <h4 className="font-semibold">{d.title}</h4>
            </div>
            <MarkdownLite content={d.content} />
            {d.sources.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t pt-3">
                <span className="text-xs text-muted-foreground">Based on:</span>
                {d.sources.map((s) => (
                  <Badge key={s} variant="outline" className="font-normal">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {content.dataGaps.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4" />
            Data gaps
          </h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-200">
            {content.dataGaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** "Draft GRI disclosures with AI": drafts report text from the saved assessment and keeps a history. */
export function GriDrafter({ client, isDemo, hasTopics }: { client: SemaClient; isDemo: boolean; hasTopics: boolean }) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const { data: aiStatus } = useAiStatus();
  const drafts = useGriDrafts(isDemo ? undefined : client.id);
  const generate = useGenerateGriDraft();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = drafts.data ?? [];
  const selected = list.find((d) => d.id === selectedId) ?? list[0] ?? null;
  const aiOff = aiStatus?.configured === false;
  const pendingForThisClient = generate.isPending && generate.variables === client.id;

  const blocker = isDemo
    ? 'The demo organization is sample data, so AI drafting is turned off for it. Select or create your own organization.'
    : !isAuthenticated
      ? 'Sign in to draft disclosures.'
      : !hasTopics
        ? 'Add material topics in the Questionnaire Engine or the Internal Assessment first; the draft is built from them.'
        : null;

  const onGenerate = () => {
    generate.mutate(client.id, {
      onSuccess: (draft) => {
        setSelectedId(draft.id);
        toast({ title: 'GRI draft ready', description: `${draft.content.disclosures.length} disclosures drafted for ${client.name}.` });
      },
    });
  };

  return (
    <Card className="border-violet-200 dark:border-violet-900">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 shrink-0 text-violet-600" />
              Draft GRI disclosures with AI
            </CardTitle>
            <CardDescription className="mt-1.5">
              Drafts GRI 2-29, 3-1, 3-2, 3-3 and, when you have a certificate, 305-1 and 305-2 from your saved stakeholders, topics and emissions.
              It uses only your data and marks anything missing as <span className="rounded bg-amber-100 px-1 text-amber-900 dark:bg-amber-950 dark:text-amber-200">[DATA NEEDED]</span>.
            </CardDescription>
          </div>
          {!isAuthenticated && !isDemo ? (
            <Button onClick={openAuthModal} className="shrink-0 self-start">
              <LogIn className="mr-2 h-4 w-4" /> Sign in
            </Button>
          ) : (
            <Button
              onClick={onGenerate}
              disabled={Boolean(blocker) || aiOff || generate.isPending}
              className="shrink-0 self-start bg-violet-600 text-white hover:bg-violet-700"
            >
              {pendingForThisClient ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {pendingForThisClient ? 'Drafting...' : list.length > 0 ? 'Generate new draft' : 'Generate draft'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <AiUnavailable feature="GRI drafting" />
        {blocker && (isAuthenticated || isDemo) && (
          <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {blocker}
          </p>
        )}

        {pendingForThisClient && <ElapsedProgress />}

        {generate.isError && generate.variables === client.id && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Drafting failed</AlertTitle>
            <AlertDescription>{errorMessage(generate.error)}</AlertDescription>
          </Alert>
        )}

        {drafts.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Could not load previous drafts: {errorMessage(drafts.error)}</AlertDescription>
          </Alert>
        )}

        {!isDemo && drafts.isLoading && isAuthenticated && <div className="h-24 animate-pulse rounded-lg bg-muted/50" />}

        {selected && (
          <div className={cn('grid gap-5', list.length > 1 && 'lg:grid-cols-[minmax(0,1fr)_220px]')}>
            <DraftView draft={selected} organization={client.name} />
            {list.length > 1 && (
              <aside className="order-first space-y-2 lg:order-last">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <History className="h-4 w-4" /> Previous drafts
                </h4>
                <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                  {list.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedId(d.id)}
                      aria-pressed={d.id === selected.id}
                      className={cn(
                        'shrink-0 rounded-md border px-3 py-2 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        d.id === selected.id ? 'border-violet-400 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/50' : 'hover:bg-muted',
                      )}
                    >
                      <span className="block font-medium">{format(new Date(d.created_at), 'PP p')}</span>
                      <span className="block text-muted-foreground">
                        {d.content.disclosures.length} disclosures, {d.content.dataGaps.length} gaps
                      </span>
                    </button>
                  ))}
                </div>
              </aside>
            )}
          </div>
        )}

        {!selected && !pendingForThisClient && !isDemo && isAuthenticated && !drafts.isLoading && !drafts.isError && (
          <div className="flex flex-col items-center rounded-lg border border-dashed px-4 py-8 text-center">
            <FileText className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No drafts yet. Generated drafts are saved here for this organization.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
