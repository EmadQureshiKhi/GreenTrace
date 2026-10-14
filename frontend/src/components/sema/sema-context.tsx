'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { chainConfig, hashscanTopicMessageUrl, hashscanUrl } from '@/lib/chain-config';
import { errorMessage } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import type { SemaTransaction } from '@/components/ui/hcs-transaction-display';
import { DEMO_CLIENT, DEMO_DATA, isDemoClient } from './sema-demo-data';
import {
  EXTERNAL_MATERIALITY_THRESHOLD,
  baseSampleSize,
  internalSignificance,
  stakeholderScores,
  zScore,
  type ClientInput,
  type InternalTopicInput,
  type MaterialTopicInput,
  type ResponseInput,
  type SampleParametersInput,
  type SemaClient,
  type SemaInternalTopic,
  type SemaMaterialTopic,
  type SemaModule,
  type SemaQuestionnaireResponse,
  type SemaReport,
  type SemaReportTopic,
  type SemaSampleParameters,
  type SemaStakeholder,
  type StakeholderInput,
} from './sema-types';

export type { SemaTransaction };

export interface FinalizeReportInput {
  materialTopics: SemaReportTopic[];
  griDisclosures: { topic: string; griCode: string }[];
  processSummary: Record<string, unknown>;
}

interface SemaContextType {
  clients: SemaClient[];
  activeClient: SemaClient | null;
  isDemo: boolean;
  setActiveClient: (client: SemaClient) => void;
  addClient: (input: ClientInput) => Promise<SemaClient>;
  updateClient: (id: string, input: ClientInput) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;

  stakeholders: SemaStakeholder[];
  sampleParameters: SemaSampleParameters | null;
  materialTopics: SemaMaterialTopic[];
  internalTopics: SemaInternalTopic[];
  questionnaireResponses: SemaQuestionnaireResponse[];
  reports: SemaReport[];

  refreshData: () => Promise<void>;
  reloadClients: () => Promise<void>;
  isLoading: boolean;
  /** Set when the last load from the database failed. */
  loadError: string | null;

  latestClientHcsTx: SemaTransaction | null;
  latestStakeholderHcsTx: SemaTransaction | null;
  latestSampleParamsHcsTx: SemaTransaction | null;
  latestMaterialTopicHcsTx: SemaTransaction | null;
  latestInternalTopicHcsTx: SemaTransaction | null;
  latestReportHcsTx: SemaTransaction | null;

  addStakeholder: (input: StakeholderInput) => Promise<void>;
  updateStakeholder: (id: string, input: StakeholderInput) => Promise<void>;
  deleteStakeholder: (id: string) => Promise<void>;
  updateSampleParameters: (input: SampleParametersInput) => Promise<void>;
  addMaterialTopic: (input: MaterialTopicInput) => Promise<void>;
  updateMaterialTopic: (id: string, input: MaterialTopicInput) => Promise<void>;
  deleteMaterialTopic: (id: string) => Promise<void>;
  addQuestionnaireResponse: (input: ResponseInput) => Promise<void>;
  deleteQuestionnaireResponse: (response: SemaQuestionnaireResponse) => Promise<void>;
  addInternalTopic: (input: InternalTopicInput) => Promise<void>;
  updateInternalTopic: (id: string, input: InternalTopicInput) => Promise<void>;
  deleteInternalTopic: (id: string) => Promise<void>;
  finalizeReport: (input: FinalizeReportInput) => Promise<SemaReport>;

  setActiveSemaModule: (module: SemaModule) => void;
  setOpenAdminClientForm: (isOpen: boolean) => void;
}

export type { SemaContextType };

export const SemaContext = createContext<SemaContextType | undefined>(undefined);

const DEMO_READ_ONLY =
  'The demo organization holds sample data and is read-only. Create your own organization in the Admin Panel to save changes.';

type TxSetter = (tx: SemaTransaction | null) => void;

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

interface SemaProviderProps {
  children: ReactNode;
  setActiveSemaModule: (module: SemaModule) => void;
  setOpenAdminClientForm: (isOpen: boolean) => void;
}

export function SemaProvider({ children, setActiveSemaModule, setOpenAdminClientForm }: SemaProviderProps) {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [clients, setClients] = useState<SemaClient[]>([DEMO_CLIENT]);
  // Null until we know whether the user has organizations of their own, so the demo does not flash first.
  const [activeClient, setActiveClientState] = useState<SemaClient | null>(null);
  const [stakeholders, setStakeholders] = useState<SemaStakeholder[]>([]);
  const [sampleParameters, setSampleParameters] = useState<SemaSampleParameters | null>(null);
  const [materialTopics, setMaterialTopics] = useState<SemaMaterialTopic[]>([]);
  const [internalTopics, setInternalTopics] = useState<SemaInternalTopic[]>([]);
  const [questionnaireResponses, setQuestionnaireResponses] = useState<SemaQuestionnaireResponse[]>([]);
  const [reports, setReports] = useState<SemaReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [latestClientHcsTx, setLatestClientHcsTx] = useState<SemaTransaction | null>(null);
  const [latestStakeholderHcsTx, setLatestStakeholderHcsTx] = useState<SemaTransaction | null>(null);
  const [latestSampleParamsHcsTx, setLatestSampleParamsHcsTx] = useState<SemaTransaction | null>(null);
  const [latestMaterialTopicHcsTx, setLatestMaterialTopicHcsTx] = useState<SemaTransaction | null>(null);
  const [latestInternalTopicHcsTx, setLatestInternalTopicHcsTx] = useState<SemaTransaction | null>(null);
  const [latestReportHcsTx, setLatestReportHcsTx] = useState<SemaTransaction | null>(null);

  const isDemo = isDemoClient(activeClient);
  // Guards against a slow load for a previous client overwriting the data of the one now selected.
  const loadToken = useRef(0);

  // ------------------------------------------------------------------------ loading

  const loadClients = useCallback(async () => {
    if (authLoading) return;
    if (!userId) {
      setClients([DEMO_CLIENT]);
      setActiveClientState(DEMO_CLIENT);
      return;
    }
    const { data, error } = await supabase
      .from('sema_clients')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      setLoadError(`Could not load your organizations: ${error.message}`);
      setClients([DEMO_CLIENT]);
      setActiveClientState((prev) => prev ?? DEMO_CLIENT);
      return;
    }
    const own = (data ?? []) as SemaClient[];
    setClients([DEMO_CLIENT, ...own]);
    setActiveClientState((prev) => {
      const stillThere = prev && own.find((c) => c.id === prev.id);
      if (stillThere) return stillThere;
      if (prev && isDemoClient(prev) && own.length === 0) return prev;
      return own[0] ?? DEMO_CLIENT;
    });
  }, [userId, authLoading]);

  /** Loads an organization's data. A silent load (after a save) keeps the current data on screen. */
  const loadClientData = useCallback(async (client: SemaClient, silent = false) => {
    const token = ++loadToken.current;
    setLoadError(null);

    if (isDemoClient(client)) {
      setStakeholders(DEMO_DATA.stakeholders);
      setSampleParameters(DEMO_DATA.sampleParameters);
      setMaterialTopics(DEMO_DATA.materialTopics);
      setInternalTopics(DEMO_DATA.internalTopics);
      setQuestionnaireResponses(DEMO_DATA.questionnaireResponses);
      setReports(DEMO_DATA.reports);
      setIsLoading(false);
      return;
    }

    if (!silent) setIsLoading(true);
    try {
      const [stakeholdersRes, sampleRes, topicsRes, internalRes, reportsRes] = await Promise.all([
        supabase.from('sema_stakeholders').select('*').eq('client_id', client.id).order('created_at'),
        supabase.from('sema_sample_parameters').select('*').eq('client_id', client.id).maybeSingle(),
        supabase.from('sema_material_topics').select('*').eq('client_id', client.id).order('created_at'),
        supabase.from('sema_internal_topics').select('*').eq('client_id', client.id).order('created_at'),
        supabase.from('sema_reports').select('*').eq('client_id', client.id).order('generated_at', { ascending: false }),
      ]);
      check(stakeholdersRes.error, 'Load stakeholders');
      check(sampleRes.error, 'Load sample parameters');
      check(topicsRes.error, 'Load material topics');
      check(internalRes.error, 'Load internal topics');
      check(reportsRes.error, 'Load reports');

      const topics = (topicsRes.data ?? []) as SemaMaterialTopic[];
      let responses: SemaQuestionnaireResponse[] = [];
      if (topics.length > 0) {
        const responsesRes = await supabase
          .from('sema_questionnaire_responses')
          .select('*')
          .in('topic_id', topics.map((t) => t.id))
          .order('created_at', { ascending: false });
        check(responsesRes.error, 'Load questionnaire responses');
        responses = (responsesRes.data ?? []) as SemaQuestionnaireResponse[];
      }

      if (token !== loadToken.current) return;
      // numeric columns arrive as strings from PostgREST when they are not integers
      setStakeholders(
        ((stakeholdersRes.data ?? []) as SemaStakeholder[]).map((s) => ({
          ...s,
          total_score: Number(s.total_score),
          normalized_score: Number(s.normalized_score),
          population_size: Number(s.population_size),
        })),
      );
      const sample = sampleRes.data as SemaSampleParameters | null;
      if (sample) {
        const params = {
          confidence_level: Number(sample.confidence_level),
          margin_error: Number(sample.margin_error),
          population_proportion: Number(sample.population_proportion),
        };
        // Derived values come from the parameters, so a stored row can never disagree with the calculator.
        setSampleParameters({ ...sample, ...params, z_score: zScore(params.confidence_level), base_sample_size: baseSampleSize(params) });
      } else {
        setSampleParameters(null);
      }
      setMaterialTopics(topics.map((t) => ({ ...t, average_score: Number(t.average_score) })));
      setInternalTopics(
        ((internalRes.data ?? []) as SemaInternalTopic[]).map((t) => ({
          ...t,
          severity: Number(t.severity),
          likelihood: Number(t.likelihood),
          significance: Number(t.significance),
        })),
      );
      setQuestionnaireResponses(responses.map((r) => ({ ...r, score: Number(r.score) })));
      setReports((reportsRes.data ?? []) as SemaReport[]);
    } catch (error) {
      if (token !== loadToken.current) return;
      setLoadError(errorMessage(error));
      if (silent) return;
      setStakeholders([]);
      setSampleParameters(null);
      setMaterialTopics([]);
      setInternalTopics([]);
      setQuestionnaireResponses([]);
      setReports([]);
    } finally {
      if (token === loadToken.current) setIsLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    if (activeClient) await loadClientData(activeClient, true);
  }, [activeClient, loadClientData]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const activeClientId = activeClient?.id;
  useEffect(() => {
    if (activeClient) void loadClientData(activeClient);
    // Reload only when the selected organization changes, not when its fields are edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClientId, loadClientData]);

  const setActiveClient = useCallback((client: SemaClient) => {
    setActiveClientState(client);
    setLatestClientHcsTx(null);
    setLatestStakeholderHcsTx(null);
    setLatestSampleParamsHcsTx(null);
    setLatestMaterialTopicHcsTx(null);
    setLatestInternalTopicHcsTx(null);
    setLatestReportHcsTx(null);
  }, []);

  // ------------------------------------------------------------------------ Hedera audit log

  /**
   * Logs a change to Hedera Consensus Service through the server, which hashes the payload and
   * records only the action, organization and hash. The database write has already happened, so a
   * logging failure is shown on the section's audit card instead of failing the operation.
   */
  const logToHedera = useCallback(
    async (clientId: string, action: string, payload: Record<string, unknown>, setTx: TxSetter, description: string) => {
      const timestamp = new Date().toISOString();
      setTx({ status: 'pending', action, message: `Logging ${description.toLowerCase()} to Hedera...`, timestamp });
      try {
        const result = await api<{ txId: string; sequence: number; dataHash: string }>('/api/sema/anchor', {
          body: { clientId, action, payload },
        });
        setTx({
          status: 'success',
          action,
          txId: result.txId,
          sequence: result.sequence,
          dataHash: result.dataHash,
          hashScanUrl:
            chainConfig.topicId && result.sequence
              ? hashscanTopicMessageUrl(chainConfig.topicId, result.sequence)
              : hashscanUrl('transaction', result.txId),
          message: `${description} recorded on Hedera Consensus Service.`,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        setTx({
          status: 'error',
          action,
          message: `${description} was saved but is not yet on the Hedera audit log.`,
          error: errorMessage(error),
          timestamp: new Date().toISOString(),
        });
      }
    },
    [],
  );

  const requireWritableClient = (): SemaClient => {
    if (!activeClient) throw new Error('Select an organization first.');
    if (isDemoClient(activeClient)) throw new Error(DEMO_READ_ONLY);
    if (!userId) throw new Error('Sign in to save changes.');
    return activeClient;
  };

  // ------------------------------------------------------------------------ clients

  const addClient = async (input: ClientInput): Promise<SemaClient> => {
    if (!userId) throw new Error('Sign in to add an organization.');
    const { data, error } = await supabase
      .from('sema_clients')
      .insert({
        user_id: userId,
        name: input.name.trim(),
        description: blankToNull(input.description),
        industry: blankToNull(input.industry),
        size: blankToNull(input.size),
        status: input.status,
      })
      .select('*')
      .single();
    check(error, 'Save organization');
    const client = data as SemaClient;
    setClients((prev) => [DEMO_CLIENT, client, ...prev.filter((c) => !isDemoClient(c))]);
    setActiveClient(client);
    void logToHedera(
      client.id,
      'client_added',
      { id: client.id, name: client.name, industry: client.industry, size: client.size, status: client.status },
      setLatestClientHcsTx,
      'Organization creation',
    );
    return client;
  };

  const updateClient = async (id: string, input: ClientInput) => {
    if (isDemoClient({ id })) throw new Error(DEMO_READ_ONLY);
    const changes = {
      name: input.name.trim(),
      description: blankToNull(input.description),
      industry: blankToNull(input.industry),
      size: blankToNull(input.size),
      status: input.status,
    };
    const { data, error } = await supabase.from('sema_clients').update(changes).eq('id', id).select('*').single();
    check(error, 'Update organization');
    const client = data as SemaClient;
    setClients((prev) => prev.map((c) => (c.id === id ? client : c)));
    if (activeClient?.id === id) setActiveClientState(client);
    void logToHedera(id, 'client_updated', { id, ...changes }, setLatestClientHcsTx, 'Organization update');
  };

  const deleteClient = async (id: string) => {
    if (isDemoClient({ id })) throw new Error('The demo organization cannot be deleted.');
    // Log first: once the organization is gone the server can no longer verify ownership.
    await logToHedera(id, 'client_deleted', { id }, setLatestClientHcsTx, 'Organization deletion');
    const { error } = await supabase.from('sema_clients').delete().eq('id', id);
    check(error, 'Delete organization');
    const remaining = clients.filter((c) => c.id !== id);
    setClients(remaining);
    if (activeClient?.id === id) {
      setActiveClientState(remaining.find((c) => !isDemoClient(c)) ?? DEMO_CLIENT);
    }
  };

  // ------------------------------------------------------------------------ stakeholders

  const stakeholderRow = (input: StakeholderInput) => ({
    name: input.name.trim(),
    category: input.category,
    stakeholder_type: blankToNull(input.stakeholder_type),
    dependency_economic: input.dependency_economic,
    dependency_social: input.dependency_social,
    dependency_environmental: input.dependency_environmental,
    influence_economic: input.influence_economic,
    influence_social: input.influence_social,
    influence_environmental: input.influence_environmental,
    population_size: Math.max(0, Math.round(input.population_size)),
    ...stakeholderScores(input),
  });

  const addStakeholder = async (input: StakeholderInput) => {
    const client = requireWritableClient();
    const row = stakeholderRow(input);
    const { data, error } = await supabase
      .from('sema_stakeholders')
      .insert({ ...row, client_id: client.id })
      .select('id')
      .single();
    check(error, 'Save stakeholder');
    await refreshData();
    void logToHedera(client.id, 'stakeholder_added', { id: data?.id, ...row }, setLatestStakeholderHcsTx, 'Stakeholder addition');
  };

  const updateStakeholder = async (id: string, input: StakeholderInput) => {
    const client = requireWritableClient();
    const row = stakeholderRow(input);
    const { error } = await supabase.from('sema_stakeholders').update(row).eq('id', id);
    check(error, 'Update stakeholder');
    await refreshData();
    void logToHedera(client.id, 'stakeholder_updated', { id, ...row }, setLatestStakeholderHcsTx, 'Stakeholder update');
  };

  const deleteStakeholder = async (id: string) => {
    const client = requireWritableClient();
    const { error } = await supabase.from('sema_stakeholders').delete().eq('id', id);
    check(error, 'Delete stakeholder');
    await refreshData();
    void logToHedera(client.id, 'stakeholder_deleted', { id }, setLatestStakeholderHcsTx, 'Stakeholder deletion');
  };

  // ------------------------------------------------------------------------ sample parameters

  const updateSampleParameters = async (input: SampleParametersInput) => {
    const client = requireWritableClient();
    const row = {
      client_id: client.id,
      confidence_level: input.confidence_level,
      margin_error: input.margin_error,
      population_proportion: input.population_proportion,
      z_score: zScore(input.confidence_level),
      base_sample_size: baseSampleSize(input),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('sema_sample_parameters').upsert(row, { onConflict: 'client_id' });
    check(error, 'Save sample parameters');
    await refreshData();
    void logToHedera(
      client.id,
      'sample_parameters_updated',
      {
        confidence_level: row.confidence_level,
        margin_error: row.margin_error,
        population_proportion: row.population_proportion,
        z_score: row.z_score,
        base_sample_size: row.base_sample_size,
      },
      setLatestSampleParamsHcsTx,
      'Sample parameters update',
    );
  };

  // ------------------------------------------------------------------------ material topics and responses

  const materialTopicRow = (input: MaterialTopicInput) => ({
    name: input.name.trim(),
    description: blankToNull(input.description),
    category: input.category,
    gri_code: blankToNull(input.gri_code),
  });

  const addMaterialTopic = async (input: MaterialTopicInput) => {
    const client = requireWritableClient();
    // Scores start empty and are computed from the questionnaire responses recorded for the topic.
    const row = materialTopicRow(input);
    const { data, error } = await supabase
      .from('sema_material_topics')
      .insert({ ...row, client_id: client.id })
      .select('id')
      .single();
    check(error, 'Save material topic');
    await refreshData();
    void logToHedera(client.id, 'material_topic_added', { id: data?.id, ...row }, setLatestMaterialTopicHcsTx, 'Material topic addition');
  };

  const updateMaterialTopic = async (id: string, input: MaterialTopicInput) => {
    const client = requireWritableClient();
    const row = materialTopicRow(input);
    const { error } = await supabase.from('sema_material_topics').update(row).eq('id', id);
    check(error, 'Update material topic');
    await refreshData();
    void logToHedera(client.id, 'material_topic_updated', { id, ...row }, setLatestMaterialTopicHcsTx, 'Material topic update');
  };

  const deleteMaterialTopic = async (id: string) => {
    const client = requireWritableClient();
    const { error } = await supabase.from('sema_material_topics').delete().eq('id', id);
    check(error, 'Delete material topic');
    await refreshData();
    void logToHedera(client.id, 'material_topic_deleted', { id }, setLatestMaterialTopicHcsTx, 'Material topic deletion');
  };

  /** Recomputes a topic's average score, response count and materiality from its stored responses. */
  const recomputeTopicScore = async (topicId: string) => {
    const { data, error } = await supabase.from('sema_questionnaire_responses').select('score').eq('topic_id', topicId);
    check(error, 'Load responses');
    const scores = (data ?? []).map((r) => Number(r.score));
    const count = scores.length;
    const average = count > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / count) * 100) / 100 : 0;
    const { error: updateError } = await supabase
      .from('sema_material_topics')
      .update({ average_score: average, response_count: count, is_material: count > 0 && average >= EXTERNAL_MATERIALITY_THRESHOLD })
      .eq('id', topicId);
    check(updateError, 'Update topic score');
    return { average, count };
  };

  const addQuestionnaireResponse = async (input: ResponseInput) => {
    const client = requireWritableClient();
    const row = {
      topic_id: input.topic_id,
      stakeholder_type: input.stakeholder_type.trim(),
      respondent_name: blankToNull(input.respondent_name),
      score: input.score,
      comments: blankToNull(input.comments),
    };
    const { data, error } = await supabase.from('sema_questionnaire_responses').insert(row).select('id').single();
    check(error, 'Save response');
    const { average, count } = await recomputeTopicScore(input.topic_id);
    await refreshData();
    void logToHedera(
      client.id,
      'questionnaire_response_added',
      { id: data?.id, ...row, topicAverage: average, topicResponses: count },
      setLatestMaterialTopicHcsTx,
      'Questionnaire response',
    );
  };

  const deleteQuestionnaireResponse = async (response: SemaQuestionnaireResponse) => {
    const client = requireWritableClient();
    const { error } = await supabase.from('sema_questionnaire_responses').delete().eq('id', response.id);
    check(error, 'Delete response');
    const { average, count } = await recomputeTopicScore(response.topic_id);
    await refreshData();
    void logToHedera(
      client.id,
      'questionnaire_response_deleted',
      { id: response.id, topicId: response.topic_id, topicAverage: average, topicResponses: count },
      setLatestMaterialTopicHcsTx,
      'Questionnaire response deletion',
    );
  };

  // ------------------------------------------------------------------------ internal topics

  const internalTopicRow = (input: InternalTopicInput) => ({
    name: input.name.trim(),
    description: blankToNull(input.description),
    category: input.category,
    severity: input.severity,
    likelihood: input.likelihood,
    ...internalSignificance(input.severity, input.likelihood),
  });

  const addInternalTopic = async (input: InternalTopicInput) => {
    const client = requireWritableClient();
    const row = internalTopicRow(input);
    const { data, error } = await supabase
      .from('sema_internal_topics')
      .insert({ ...row, client_id: client.id })
      .select('id')
      .single();
    check(error, 'Save internal topic');
    await refreshData();
    void logToHedera(client.id, 'internal_topic_added', { id: data?.id, ...row }, setLatestInternalTopicHcsTx, 'Internal topic addition');
  };

  const updateInternalTopic = async (id: string, input: InternalTopicInput) => {
    const client = requireWritableClient();
    const row = internalTopicRow(input);
    const { error } = await supabase.from('sema_internal_topics').update(row).eq('id', id);
    check(error, 'Update internal topic');
    await refreshData();
    void logToHedera(client.id, 'internal_topic_updated', { id, ...row }, setLatestInternalTopicHcsTx, 'Internal topic update');
  };

  const deleteInternalTopic = async (id: string) => {
    const client = requireWritableClient();
    const { error } = await supabase.from('sema_internal_topics').delete().eq('id', id);
    check(error, 'Delete internal topic');
    await refreshData();
    void logToHedera(client.id, 'internal_topic_deleted', { id }, setLatestInternalTopicHcsTx, 'Internal topic deletion');
  };

  // ------------------------------------------------------------------------ reports

  const finalizeReport = async (input: FinalizeReportInput): Promise<SemaReport> => {
    const client = requireWritableClient();
    const generatedAt = new Date();
    const { data, error } = await supabase
      .from('sema_reports')
      .insert({
        client_id: client.id,
        title: `${client.name} SEMA report, ${generatedAt.toISOString().slice(0, 10)}`,
        report_type: 'full_sema',
        material_topics: input.materialTopics,
        gri_disclosures: { mapped: input.griDisclosures },
        process_summary: input.processSummary,
        status: 'final',
        generated_at: generatedAt.toISOString(),
      })
      .select('*')
      .single();
    check(error, 'Save report');
    const report = data as SemaReport;
    await refreshData();
    await logToHedera(
      client.id,
      'sema_report_finalized',
      {
        reportId: report.id,
        title: report.title,
        materialTopics: input.materialTopics,
        griDisclosures: input.griDisclosures,
        processSummary: input.processSummary,
      },
      setLatestReportHcsTx,
      'SEMA report',
    );
    return report;
  };

  return (
    <SemaContext.Provider
      value={{
        clients,
        activeClient,
        isDemo,
        setActiveClient,
        addClient,
        updateClient,
        deleteClient,
        stakeholders,
        sampleParameters,
        materialTopics,
        internalTopics,
        questionnaireResponses,
        reports,
        refreshData,
        reloadClients: loadClients,
        isLoading,
        loadError,
        latestClientHcsTx,
        latestStakeholderHcsTx,
        latestSampleParamsHcsTx,
        latestMaterialTopicHcsTx,
        latestInternalTopicHcsTx,
        latestReportHcsTx,
        addStakeholder,
        updateStakeholder,
        deleteStakeholder,
        updateSampleParameters,
        addMaterialTopic,
        updateMaterialTopic,
        deleteMaterialTopic,
        addQuestionnaireResponse,
        deleteQuestionnaireResponse,
        addInternalTopic,
        updateInternalTopic,
        deleteInternalTopic,
        finalizeReport,
        setActiveSemaModule,
        setOpenAdminClientForm,
      }}
    >
      {children}
    </SemaContext.Provider>
  );
}

export function useSema() {
  const context = useContext(SemaContext);
  if (context === undefined) {
    throw new Error('useSema must be used within a SemaProvider');
  }
  return context;
}
