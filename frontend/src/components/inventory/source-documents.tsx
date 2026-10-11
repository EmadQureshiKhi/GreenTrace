import { AlertCircle, FileText, Image as ImageIcon } from 'lucide-react';
import { AiLabel } from '@/components/ai/ai-label';
import { ConsensusProof } from '@/components/chain/consensus-proof';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { errorMessage, shortHash } from '@/lib/format';
import type { DocumentRecord } from '@/lib/types';
import { formatBytes } from './inventory-utils';

const TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
};

export function SourceDocuments({ documents, loading, error }: { documents: DocumentRecord[] | undefined; loading: boolean; error: unknown }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Source documents</CardTitle>
        <CardDescription>Bills the AI read for this inventory. Each reading is anchored on Hedera.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <div className="h-12 animate-pulse rounded bg-muted" />
            <div className="h-12 animate-pulse rounded bg-muted" />
          </div>
        ) : error ? (
          <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
            Could not load documents: {errorMessage(error)}
          </p>
        ) : !documents || documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents are linked to this inventory.</p>
        ) : (
          <ul className="divide-y">
            {documents.map((doc) => {
              const Icon = doc.mime_type === 'application/pdf' ? FileText : ImageIcon;
              return (
                <li key={doc.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="truncate text-sm font-medium" title={doc.file_name}>
                      {doc.file_name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{TYPE_LABELS[doc.mime_type] ?? doc.mime_type}</span>
                      <span>{formatBytes(doc.size_bytes)}</span>
                      <span className="font-mono" title={`SHA-256 ${doc.sha256}`}>
                        {shortHash(doc.sha256)}
                      </span>
                      {doc.model && <AiLabel model={doc.model} text={doc.model} className="max-w-full truncate" />}
                    </div>
                    <ConsensusProof sequence={doc.hcs_sequence} label="Reading anchored" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
