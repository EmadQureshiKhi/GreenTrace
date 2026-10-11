'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type {
  AiAudit,
  CarbonCredit,
  Certificate,
  CreditRating,
  DocumentRecord,
  EmissionData,
  Order,
  ReductionPlan,
  Retirement,
} from '@/lib/types';
import { useAuth } from './use-auth';

/** The mirror node lags consensus by a few seconds; balances are refetched again once it has caught up. */
const MIRROR_LAG_MS = 6000;

// Data hooks. Reads go straight to Supabase under row level security; anything that changes on-chain
// state or calls the AI goes through the API routes.

async function rows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// --------------------------------------------------------------------------- inventories

export function useInventories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['inventories', user?.id],
    enabled: Boolean(user),
    queryFn: () => rows<EmissionData>(supabase.from('emission_data').select('*').order('created_at', { ascending: false })),
  });
}

export function useInventory(id: string | undefined) {
  return useQuery({
    queryKey: ['inventory', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('emission_data').select('*').eq('id', id!).maybeSingle<EmissionData>();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export interface InventoryLinePayload {
  id: string;
  catalogId: string;
  quantity: number;
  unit: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  documentId?: string | null;
  evidence?: string | null;
  confidence?: number | null;
  edited?: boolean;
  description?: string | null;
}

export interface InventoryPayload {
  source: 'calculator' | 'upload' | 'ai_extraction';
  organization: string;
  fileName?: string | null;
  reportingPeriodStart?: string | null;
  reportingPeriodEnd?: string | null;
  lines: InventoryLinePayload[];
  rawData?: unknown[];
}

export function useSaveInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: InventoryPayload }) =>
      api<{ inventory: EmissionData }>(id ? `/api/inventories/${id}` : '/api/inventories', {
        method: id ? 'PUT' : 'POST',
        body: payload,
      }).then((r) => r.inventory),
    onSuccess: (inventory) => {
      queryClient.invalidateQueries({ queryKey: ['inventories'] });
      queryClient.setQueryData(['inventory', inventory.id], inventory);
      queryClient.invalidateQueries({ queryKey: ['audits', inventory.id] });
    },
  });
}

export function useDeleteInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/inventories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventories'] });
      queryClient.invalidateQueries({ queryKey: ['my-audits'] });
    },
  });
}

export function useInventoryDocuments(inventoryId: string | undefined) {
  return useQuery({
    queryKey: ['documents', inventoryId],
    enabled: Boolean(inventoryId),
    queryFn: () => rows<DocumentRecord>(supabase.from('documents').select('*').eq('emission_data_id', inventoryId!)),
  });
}

// --------------------------------------------------------------------------- AI

export function useAiStatus() {
  return useQuery({
    queryKey: ['ai-status'],
    staleTime: Infinity,
    queryFn: () => api<{ configured: boolean; provider: string | null; model: string | null }>('/api/ai/status'),
  });
}

export function useAudits(inventoryId: string | undefined) {
  return useQuery({
    queryKey: ['audits', inventoryId],
    enabled: Boolean(inventoryId),
    queryFn: () =>
      rows<AiAudit>(supabase.from('ai_audits').select('*').eq('emission_data_id', inventoryId!).order('created_at', { ascending: false })),
  });
}

export function useRunAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emissionDataId: string) => api<{ audit: AiAudit }>('/api/ai/audit', { body: { emissionDataId } }).then((r) => r.audit),
    onSuccess: (audit) => queryClient.invalidateQueries({ queryKey: ['audits', audit.emission_data_id] }),
  });
}

export function useReductionPlans(inventoryId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['reduction-plans', user?.id, inventoryId],
    enabled: Boolean(user),
    queryFn: () => {
      let query = supabase.from('reduction_plans').select('*').order('created_at', { ascending: false });
      if (inventoryId) query = query.eq('emission_data_id', inventoryId);
      return rows<ReductionPlan>(query);
    },
  });
}

export function useCreateReductionPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { emissionDataId: string; industry: string; region: string; budget: 'low' | 'medium' | 'high'; targetYear: number; notes?: string }) =>
      api<{ plan: ReductionPlan }>('/api/ai/reduction-plan', { body: input }).then((r) => r.plan),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reduction-plans'] }),
  });
}

// --------------------------------------------------------------------------- certificates

export function useCertificates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['certificates', user?.id],
    enabled: Boolean(user),
    queryFn: () =>
      rows<Certificate>(supabase.from('certificates').select('*').eq('user_id', user!.id).order('created_at', { ascending: false })),
  });
}

export function useCertificateForInventory(inventoryId: string | undefined) {
  return useQuery({
    queryKey: ['certificate-for-inventory', inventoryId],
    enabled: Boolean(inventoryId),
    queryFn: async () => {
      const { data } = await supabase.from('certificates').select('*').eq('emission_data_id', inventoryId!).maybeSingle<Certificate>();
      return data ?? null;
    },
  });
}

export function useIssueCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { emissionDataId: string; title?: string }) =>
      api<{ certificate: Certificate }>('/api/certificates', { body: input }).then((r) => r.certificate),
    onSuccess: (certificate) => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      queryClient.invalidateQueries({ queryKey: ['certificate-for-inventory', certificate.emission_data_id] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
    },
  });
}

export interface VerificationResult {
  certificate: Certificate;
  inventory: Pick<EmissionData, 'id' | 'source' | 'reporting_period_start' | 'reporting_period_end' | 'processed_data'> | null;
  audit: AiAudit | null;
  retirements: Retirement[];
  checks: { id: string; label: string; status: 'pass' | 'fail' | 'pending'; detail: string }[];
  verified: boolean;
}

export function useCertificateVerification(certificateId: string | undefined) {
  return useQuery({
    queryKey: ['verification', certificateId],
    enabled: Boolean(certificateId),
    // A missing certificate is an answer, not a transient failure.
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
    queryFn: () => api<VerificationResult>(`/api/certificates/${encodeURIComponent(certificateId!)}/verify`),
    // A fresh certificate's records reach the mirror node a few seconds after issuance; recheck until they do.
    refetchInterval: (query) =>
      query.state.data?.checks.some((c) => c.status === 'pending') && query.state.dataUpdateCount < 12 ? 5_000 : false,
  });
}

export interface OffsetAdvice {
  summary: string;
  considerations: string[];
  tonnesNeeded: number;
  basket: { creditId: string; title: string; quantity: number; priceHbar: number; costHbar: number; grade: string | null; reason: string }[];
  totalTonnes: number;
  totalCostHbar: number;
  coverage: number;
  model: string;
}

export function useOffsetAdvisor() {
  return useMutation({
    mutationFn: (input: { certificateId: string; budgetHbar: number | null; preferences?: string }) =>
      api<{ advice: OffsetAdvice }>('/api/ai/offset-advisor', { body: input }).then((r) => r.advice),
  });
}

export function useRetire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (txHash: string) => api<{ retirement: Retirement }>('/api/retirements', { body: { txHash } }).then((r) => r.retirement),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification'] });
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['wallet'] }), MIRROR_LAG_MS);
    },
  });
}

// --------------------------------------------------------------------------- marketplace

export function useCredits() {
  return useQuery({
    queryKey: ['credits'],
    queryFn: () => rows<CarbonCredit>(supabase.from('carbon_credits').select('*').order('price_hbar', { ascending: true })),
  });
}

export function useCreditRatings() {
  return useQuery({
    queryKey: ['credit-ratings'],
    queryFn: () => rows<CreditRating>(supabase.from('credit_ratings').select('*')),
  });
}

export function useRateCredit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { creditId: string; refresh?: boolean }) =>
      api<{ rating: CreditRating }>('/api/ai/credit-rating', { body: input }).then((r) => r.rating),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['credit-ratings'] }),
  });
}

export function useOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['orders', user?.id],
    enabled: Boolean(user),
    queryFn: () => rows<Order>(supabase.from('orders').select('*').order('created_at', { ascending: false })),
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (input: { creditId: string; quantity: number }) => api<{ order: Order }>('/api/orders', { body: input }).then((r) => r.order),
  });
}

export function useConfirmOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, txHash }: { orderId: string; txHash: string }) =>
      api<{ order: Order }>(`/api/orders/${orderId}/confirm`, { body: { txHash } }).then((r) => r.order),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['wallet'] }), MIRROR_LAG_MS);
    },
  });
}

// --------------------------------------------------------------------------- wallet

export interface WalletStatus {
  address: string;
  accountId: string | null;
  hbar: number;
  co2e: number;
  canReceiveCo2e: boolean;
}

export function useWalletStatus() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['wallet', profile?.wallet_address],
    enabled: Boolean(profile?.wallet_address),
    refetchInterval: 30_000,
    queryFn: () => api<{ wallet: WalletStatus | null }>('/api/wallet').then((r) => r.wallet),
  });
}

// --------------------------------------------------------------------------- public stats

export interface PlatformStats {
  certificates: number;
  certifiedTonnes: number;
  retiredTonnes: number;
  creditsListed: number;
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: async (): Promise<PlatformStats> => {
      const [certs, retirements, credits] = await Promise.all([
        rows<Pick<Certificate, 'total_emissions'>>(supabase.from('certificates').select('total_emissions')),
        rows<Pick<Retirement, 'amount'>>(supabase.from('retirements').select('amount').eq('status', 'completed')),
        rows<Pick<CarbonCredit, 'available'>>(supabase.from('carbon_credits').select('available')),
      ]);
      return {
        certificates: certs.length,
        certifiedTonnes: certs.reduce((sum, c) => sum + Number(c.total_emissions) / 1000, 0),
        retiredTonnes: retirements.reduce((sum, r) => sum + r.amount, 0),
        creditsListed: credits.reduce((sum, c) => sum + c.available, 0),
      };
    },
  });
}
