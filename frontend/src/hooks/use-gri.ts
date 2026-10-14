'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { GriDraft } from '@/lib/types';
import { useAuth } from './use-auth';

export type { GriDraft, GriDraftContent } from '@/lib/types';

/** AI-drafted GRI disclosures saved for a SEMA organization, newest first. */
export function useGriDrafts(clientId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['gri-drafts', clientId],
    enabled: Boolean(user && clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gri_drafts')
        .select('*')
        .eq('client_id', clientId!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as GriDraft[];
    },
  });
}

/** Drafts GRI disclosures from the organization's saved assessment. Takes 30-90 seconds. */
export function useGenerateGriDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) => api<{ draft: GriDraft }>('/api/ai/gri-draft', { body: { clientId } }).then((r) => r.draft),
    onSuccess: (draft) => {
      queryClient.setQueryData<GriDraft[]>(['gri-drafts', draft.client_id], (prev) => [draft, ...(prev ?? []).filter((d) => d.id !== draft.id)]);
      void queryClient.invalidateQueries({ queryKey: ['gri-drafts', draft.client_id] });
    },
  });
}
