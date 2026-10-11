'use client';

import { AlertTriangle, CheckCircle2, Copy, FileText, Image as ImageIcon, Loader2, RotateCcw, Sparkles, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { AiLabel } from '@/components/ai/ai-label';
import { AiUnavailable } from '@/components/ai/ai-unavailable';
import { ConsensusProof } from '@/components/chain/consensus-proof';
import { formatBytes } from '@/components/inventory/inventory-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAiStatus } from '@/hooks/use-api';
import { BILL_MEDIA_TYPES, MAX_BILL_BYTES, useExtractBill, type ExtractionResult } from '@/hooks/use-measure';
import { errorMessage } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CreateInventoryPanel } from './create-inventory-panel';
import { draftFromExtracted, manualDraft, type DraftLine } from './draft-lines';
import { LinesReviewTable } from './lines-review-table';

type FileStatus = 'queued' | 'reading' | 'done' | 'duplicate' | 'failed';

interface UploadItem {
  key: string;
  file: File;
  status: FileStatus;
  error: string | null;
  result: ExtractionResult | null;
  startedAt: number | null;
}

/** Files read at the same time. Each reading takes 20-60 seconds. */
const CONCURRENCY = 2;

let itemCounter = 0;

function rejectionMessage(rejection: FileRejection): string {
  const code = rejection.errors[0]?.code;
  if (code === 'file-too-large') return 'Larger than 10 MB.';
  if (code === 'file-invalid-type') return 'Not a PDF, PNG, JPEG or WebP file.';
  return rejection.errors[0]?.message ?? 'File not accepted.';
}

export function BillReader() {
  const extract = useExtractBill();
  const { data: aiStatus } = useAiStatus();
  const aiOff = aiStatus?.configured === false;
  const [items, setItems] = useState<UploadItem[]>([]);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const started = useRef(new Set<string>());
  const sessionDocuments = useRef(new Set<string>());
  const [now, setNow] = useState(() => Date.now());

  const patchItem = useCallback((key: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }, []);

  const addLinesFrom = useCallback((result: ExtractionResult) => {
    setLines((prev) => {
      if (prev.some((l) => l.documentId === result.document.id)) return prev;
      return [...prev, ...result.lines.map((line) => draftFromExtracted(line, result.document))];
    });
  }, []);

  // Start queued files while fewer than CONCURRENCY are being read.
  useEffect(() => {
    const reading = items.filter((i) => i.status === 'reading').length;
    const next = items.filter((i) => i.status === 'queued' && !started.current.has(i.key)).slice(0, Math.max(0, CONCURRENCY - reading));
    if (next.length === 0) return;
    for (const item of next) {
      started.current.add(item.key);
      patchItem(item.key, { status: 'reading', startedAt: Date.now(), error: null });
      extract(item.file)
        .then((result) => {
          // Hold lines back only when the earlier copy is counted somewhere: already in an inventory, or
          // read earlier in this same session. A copy left over from an abandoned upload is not a duplicate.
          const twin = result.duplicateOf;
          const counted = twin && (twin.inventoryId !== null || sessionDocuments.current.has(twin.id));
          sessionDocuments.current.add(result.document.id);
          if (counted) {
            patchItem(item.key, { status: 'duplicate', result });
          } else {
            patchItem(item.key, { status: 'done', result });
            addLinesFrom(result);
          }
        })
        .catch((error: unknown) => patchItem(item.key, { status: 'failed', error: errorMessage(error) }));
    }
  }, [items, extract, patchItem, addLinesFrom]);

  const busy = items.some((i) => i.status === 'queued' || i.status === 'reading');
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    const make = (file: File, status: FileStatus, error: string | null): UploadItem => {
      itemCounter += 1;
      return { key: `file-${itemCounter}`, file, status, error, result: null, startedAt: null };
    };
    setItems((prev) => [
      ...prev,
      ...accepted.map((file) => make(file, 'queued', null)),
      ...rejected.map((r) => make(r.file, 'failed', rejectionMessage(r))),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: BILL_MEDIA_TYPES,
    maxSize: MAX_BILL_BYTES,
    multiple: true,
    disabled: aiOff,
  });

  const retry = (item: UploadItem) => {
    started.current.delete(item.key);
    patchItem(item.key, { status: 'queued', error: null, result: null });
  };

  const removeItem = (item: UploadItem) => {
    setItems((prev) => prev.filter((i) => i.key !== item.key));
    const documentId = item.result?.document.id;
    if (documentId && !items.some((i) => i.key !== item.key && i.result?.document.id === documentId)) {
      setLines((prev) => prev.filter((l) => l.documentId !== documentId));
    }
  };

  const updateLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const removeLine = (key: string) => setLines((prev) => prev.filter((line) => line.key !== key));
  const addLine = () => setLines((prev) => [...prev, manualDraft()]);

  const pending = items.filter((i) => i.status === 'queued' || i.status === 'reading').length;
  const fileName = useMemo(() => {
    const names = [...new Set(lines.map((l) => l.fileName).filter((n): n is string => Boolean(n)))];
    return names.length ? names.join(', ') : null;
  }, [lines]);
  const showReview = lines.length > 0 || items.some((i) => i.status === 'done' || i.status === 'duplicate');

  return (
    <div className="space-y-6">
      <AiUnavailable feature="Bill reading" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            Read bills with AI
          </CardTitle>
          <CardDescription>
            The AI only transcribes quantities from your documents. Emissions are calculated from the emission factor catalog, and each reading is anchored on Hedera.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              'cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors sm:p-8',
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
              aiOff && 'cursor-not-allowed opacity-50 hover:border-muted-foreground/25',
            )}
          >
            <input {...getInputProps()} />
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <p className="font-medium">{isDragActive ? 'Drop the files here' : 'Drop electricity, gas and fuel bills here, or click to browse'}</p>
            <p className="mt-1 text-sm text-muted-foreground">PDF, PNG, JPG or WebP, up to 10 MB each. Reading takes 20 to 60 seconds per file.</p>
          </div>

          {items.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {items.map((item) => (
                <FileRow key={item.key} item={item} now={now} lines={lines} onRetry={retry} onRemove={removeItem} onAddAnyway={addLinesFrom} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {showReview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Review extracted lines</CardTitle>
            <CardDescription>
              Check each line against its evidence before creating the inventory. Changing a source, quantity, unit or period marks the line as edited.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LinesReviewTable ai lines={lines} onChange={updateLine} onRemove={removeLine} onAdd={addLine} />
          </CardContent>
        </Card>
      )}

      {showReview && (
        <CreateInventoryPanel
          lines={lines}
          source="ai_extraction"
          fileName={fileName}
          blocker={pending > 0 ? `Wait for ${pending} ${pending === 1 ? 'file' : 'files'} to finish reading.` : null}
        />
      )}
    </div>
  );
}

function FileRow({
  item,
  now,
  lines,
  onRetry,
  onRemove,
  onAddAnyway,
}: {
  item: UploadItem;
  now: number;
  lines: DraftLine[];
  onRetry: (item: UploadItem) => void;
  onRemove: (item: UploadItem) => void;
  onAddAnyway: (result: ExtractionResult) => void;
}) {
  const { file, status, result } = item;
  const Icon = file.type === 'application/pdf' ? FileText : ImageIcon;
  const elapsed = item.startedAt ? Math.max(0, Math.round((now - item.startedAt) / 1000)) : 0;
  const added = result ? lines.some((l) => l.documentId === result.document.id) : false;
  const lineCount = result?.lines.length ?? 0;

  return (
    <li className="space-y-3 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={file.name}>
            {file.name}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{formatBytes(file.size)}</span>
            <StatusChip status={status} elapsed={elapsed} lineCount={lineCount} />
            {result?.document.model && <AiLabel model={result.document.model} text="AI reading" />}
          </div>
          {status === 'failed' && item.error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{item.error}</p>}
          {result && <ConsensusProof sequence={result.document.hcs_sequence} label="Reading anchored on Hedera" className="mt-2" />}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {status === 'failed' && item.file.size <= MAX_BILL_BYTES && Object.keys(BILL_MEDIA_TYPES).includes(item.file.type) && (
            <Button variant="ghost" size="sm" onClick={() => onRetry(item)}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Retry
            </Button>
          )}
          {status !== 'reading' && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRemove(item)} aria-label={`Remove ${file.name}`}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {status === 'done' && result?.duplicateOf?.kind === 'identical-file' && (
        <p className="text-xs text-muted-foreground">You uploaded this file before; its earlier reading was reused.</p>
      )}

      {status === 'duplicate' && result?.duplicateOf && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 [&>svg]:text-amber-600">
          <Copy className="h-4 w-4" />
          <AlertTitle>{result.duplicateOf.kind === 'identical-file' ? 'You uploaded this exact file before' : 'This looks like the same bill as another upload'}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              {result.duplicateOf.kind === 'identical-file'
                ? `It matches "${result.duplicateOf.fileName}", so the earlier reading was reused.`
                : `Supplier, account and billing period match "${result.duplicateOf.fileName}".`}{' '}
              {result.duplicateOf.inventoryId ? 'That copy is already part of an inventory, so' : 'It was read earlier in this upload, so'} its lines
              were not added and the bill is not counted twice.
            </p>
            {lineCount > 0 && (
              <Button size="sm" variant="outline" disabled={added} onClick={() => onAddAnyway(result)} className="bg-background">
                {added ? 'Lines added' : `Add its ${lineCount} ${lineCount === 1 ? 'line' : 'lines'} anyway`}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {result && result.warnings.length > 0 && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 [&>svg]:text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Notes from the reading</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {result.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </li>
  );
}

function StatusChip({ status, elapsed, lineCount }: { status: FileStatus; elapsed: number; lineCount: number }) {
  const base = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium';
  switch (status) {
    case 'queued':
      return <span className={cn(base, 'bg-muted text-muted-foreground')}>Queued</span>;
    case 'reading':
      return (
        <span className={cn(base, 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200')}>
          <Loader2 className="h-3 w-3 animate-spin" />
          Reading... {elapsed}s
        </span>
      );
    case 'done':
      return (
        <span className={cn(base, 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200')}>
          <CheckCircle2 className="h-3 w-3" />
          {lineCount} {lineCount === 1 ? 'line' : 'lines'} read
        </span>
      );
    case 'duplicate':
      return (
        <span className={cn(base, 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200')}>
          <Copy className="h-3 w-3" />
          Duplicate
        </span>
      );
    case 'failed':
      return (
        <span className={cn(base, 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200')}>
          <AlertTriangle className="h-3 w-3" />
          Failed
        </span>
      );
  }
}
