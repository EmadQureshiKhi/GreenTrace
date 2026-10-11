'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '@/lib/api';
import type { DocumentRecord, InventoryLine } from '@/lib/types';

// Client-side mirror of the bill extraction contract in src/server/ai/extract.ts (server-only).

/** One consumption line the AI read from a document. */
export interface ExtractedLine {
  id: string;
  description: string;
  catalogId: string | null;
  quantity: number;
  unit: string;
  periodStart: string | null;
  periodEnd: string | null;
  evidence: string;
  page: number | null;
  /** 0 to 1 */
  confidence: number;
  reasoning: string;
  /** Set when the line could not be computed as read; the reviewer must fix it. */
  issue: string | null;
  computed: InventoryLine | null;
}

export interface ExtractionResult {
  document: DocumentRecord;
  lines: ExtractedLine[];
  warnings: string[];
  /** Another upload of the same bill, if any. */
  duplicateOf: { id: string; fileName: string; kind: 'identical-file' | 'same-bill'; inventoryId: string | null } | null;
}

export const MAX_BILL_BYTES = 10 * 1024 * 1024;

export const BILL_MEDIA_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

/** Returns a function that sends one bill to the AI reader. Takes 20-60 seconds per file. */
export function useExtractBill() {
  const queryClient = useQueryClient();
  return useCallback(
    async (file: File): Promise<ExtractionResult> => {
      const form = new FormData();
      form.append('file', file);
      const result = await api<ExtractionResult>('/api/ai/extract', { form });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      return result;
    },
    [queryClient],
  );
}
