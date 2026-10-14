// Row shapes for the SEMA tables (supabase/migrations) and the scoring rules the tool applies.

export type SemaModule =
  | 'dashboard'
  | 'stakeholders'
  | 'sample-size'
  | 'questionnaire'
  | 'internal-assessment'
  | 'materiality-matrix'
  | 'reporting'
  | 'admin';

export type TopicCategory = 'Economic' | 'Environmental' | 'Social';

export interface SemaClient {
  id: string;
  name: string;
  description?: string | null;
  industry?: string | null;
  size?: string | null;
  /** 'demo' only exists in the browser for the built-in sample organization; the database allows active/inactive. */
  status: 'active' | 'inactive' | 'demo';
  created_at: string;
  updated_at: string;
}

export interface SemaStakeholder {
  id: string;
  client_id: string;
  name: string;
  category: 'Internal' | 'External';
  stakeholder_type?: string | null;
  dependency_economic: number;
  dependency_social: number;
  dependency_environmental: number;
  influence_economic: number;
  influence_social: number;
  influence_environmental: number;
  total_score: number;
  normalized_score: number;
  influence_category: 'High' | 'Medium' | 'Low';
  is_priority: boolean;
  population_size: number;
  created_at: string;
  updated_at: string;
}

export interface SemaSampleParameters {
  id: string;
  client_id: string;
  confidence_level: number;
  margin_error: number;
  population_proportion: number;
  z_score: number | null;
  base_sample_size: number | null;
  created_at: string;
  updated_at: string;
}

export interface SemaMaterialTopic {
  id: string;
  client_id: string;
  name: string;
  description?: string | null;
  category: TopicCategory;
  gri_code?: string | null;
  average_score: number;
  response_count: number;
  is_material: boolean;
  created_at: string;
  updated_at: string;
}

export interface SemaInternalTopic {
  id: string;
  client_id: string;
  name: string;
  description?: string | null;
  category: TopicCategory;
  severity: number;
  likelihood: number;
  significance: number;
  is_material: boolean;
  created_at: string;
  updated_at: string;
}

export interface SemaQuestionnaireResponse {
  id: string;
  topic_id: string;
  stakeholder_type: string;
  respondent_name?: string | null;
  score: number;
  comments?: string | null;
  response_time: number;
  created_at: string;
}

export interface SemaReportTopic {
  name: string;
  category: TopicCategory;
  griCode: string | null;
  source: 'external' | 'internal' | 'both';
  externalScore: number | null;
  responses: number | null;
  significance: number | null;
}

export interface SemaReport {
  id: string;
  client_id: string;
  title: string;
  report_type: 'materiality_assessment' | 'stakeholder_engagement' | 'full_sema';
  material_topics: SemaReportTopic[];
  gri_disclosures: Record<string, unknown>;
  process_summary: Record<string, unknown>;
  status: 'draft' | 'final' | 'published';
  generated_at: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------- inputs

export interface ClientInput {
  name: string;
  description: string;
  industry: string;
  size: string;
  status: 'active' | 'inactive';
}

export interface StakeholderInput {
  name: string;
  category: 'Internal' | 'External';
  stakeholder_type: string;
  dependency_economic: number;
  dependency_social: number;
  dependency_environmental: number;
  influence_economic: number;
  influence_social: number;
  influence_environmental: number;
  population_size: number;
}

export interface SampleParametersInput {
  confidence_level: number;
  margin_error: number;
  population_proportion: number;
}

export interface MaterialTopicInput {
  name: string;
  description: string;
  category: TopicCategory;
  gri_code: string;
}

export interface InternalTopicInput {
  name: string;
  description: string;
  category: TopicCategory;
  severity: number;
  likelihood: number;
}

export interface ResponseInput {
  topic_id: string;
  stakeholder_type: string;
  respondent_name: string;
  score: number;
  comments: string;
}

// ---------------------------------------------------------------------------- scoring rules

/** Stakeholders scoring at least this (out of 30) are prioritized for engagement. */
export const PRIORITY_THRESHOLD = 16;
/** Topics with an average stakeholder score at least this (out of 10) are externally material. */
export const EXTERNAL_MATERIALITY_THRESHOLD = 7;
/** Topics with severity x likelihood at least this (out of 25) are internally material. */
export const INTERNAL_MATERIALITY_THRESHOLD = 10;

export function stakeholderScores(input: Pick<
  StakeholderInput,
  | 'dependency_economic'
  | 'dependency_social'
  | 'dependency_environmental'
  | 'influence_economic'
  | 'influence_social'
  | 'influence_environmental'
>) {
  const influence = input.influence_economic + input.influence_social + input.influence_environmental;
  const dependency = input.dependency_economic + input.dependency_social + input.dependency_environmental;
  const total = influence + dependency;
  const influenceCategory: SemaStakeholder['influence_category'] = influence >= 11 ? 'High' : influence >= 7 ? 'Medium' : 'Low';
  return {
    total_score: total,
    normalized_score: Math.round((total / 30) * 100) / 100,
    influence_category: influenceCategory,
    is_priority: total >= PRIORITY_THRESHOLD,
  };
}

export function internalSignificance(severity: number, likelihood: number) {
  const significance = severity * likelihood;
  return { significance, is_material: significance >= INTERNAL_MATERIALITY_THRESHOLD };
}

const Z_SCORES: Record<string, number> = { '0.9': 1.645, '0.95': 1.96, '0.99': 2.576 };

export function zScore(confidence: number): number {
  return Z_SCORES[String(confidence)] ?? 1.96;
}

/** Cochran's formula for an infinite population: n = Z^2 p (1 - p) / E^2. */
export function baseSampleSize(params: SampleParametersInput): number {
  const z = zScore(params.confidence_level);
  return Math.ceil((z * z * params.population_proportion * (1 - params.population_proportion)) / (params.margin_error * params.margin_error));
}

/** Finite population correction, applied to groups of 100 or fewer. */
export function adjustedSampleSize(base: number, population: number): { size: number; formula: 'finite' | 'infinite' } {
  if (population > 0 && population <= 100) {
    return { size: Math.min(population, Math.ceil((base * population) / (population + base - 1))), formula: 'finite' };
  }
  return { size: base, formula: 'infinite' };
}

export interface MergedTopic {
  key: string;
  name: string;
  category: TopicCategory;
  griCode: string | null;
  /** Average stakeholder score out of 10, or null when no responses are recorded. */
  external: number | null;
  responses: number;
  /** Severity x likelihood out of 25, or null when not assessed internally. */
  internal: number | null;
  externalMaterial: boolean;
  internalMaterial: boolean;
  source: 'external' | 'internal' | 'both';
}

/** Joins the external and internal assessments by topic name. */
export function mergeTopics(materialTopics: SemaMaterialTopic[], internalTopics: SemaInternalTopic[]): MergedTopic[] {
  const byName = new Map<string, MergedTopic>();
  for (const t of materialTopics) {
    const key = t.name.trim().toLowerCase();
    byName.set(key, {
      key,
      name: t.name,
      category: t.category,
      griCode: t.gri_code ?? null,
      external: t.response_count > 0 ? t.average_score : null,
      responses: t.response_count,
      internal: null,
      externalMaterial: t.is_material,
      internalMaterial: false,
      source: 'external',
    });
  }
  for (const t of internalTopics) {
    const key = t.name.trim().toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      existing.internal = existing.internal === null ? t.significance : Math.max(existing.internal, t.significance);
      existing.internalMaterial = existing.internalMaterial || t.is_material;
      existing.source = 'both';
    } else {
      byName.set(key, {
        key,
        name: t.name,
        category: t.category,
        griCode: null,
        external: null,
        responses: 0,
        internal: t.significance,
        externalMaterial: false,
        internalMaterial: t.is_material,
        source: 'internal',
      });
    }
  }
  return Array.from(byName.values());
}

export function isPriority(t: MergedTopic): boolean {
  return (t.external ?? 0) >= EXTERNAL_MATERIALITY_THRESHOLD && (t.internal ?? 0) >= INTERNAL_MATERIALITY_THRESHOLD;
}

export interface ProcessStep {
  module: SemaModule;
  name: string;
  description: string;
  /** 0-100, from saved data. */
  progress: number;
}

/** Progress through the SEMA process, derived from what has actually been saved. */
export function processSteps(data: {
  stakeholders: SemaStakeholder[];
  sampleParameters: SemaSampleParameters | null;
  materialTopics: SemaMaterialTopic[];
  internalTopics: SemaInternalTopic[];
  reports: SemaReport[];
}): { steps: ProcessStep[]; overall: number } {
  const { stakeholders, sampleParameters, materialTopics, internalTopics, reports } = data;
  const withResponses = materialTopics.filter((t) => t.response_count > 0).length;
  const external =
    materialTopics.length === 0
      ? 0
      : withResponses === materialTopics.length
        ? 100
        : Math.max(10, Math.round((withResponses / materialTopics.length) * 100));
  const steps: ProcessStep[] = [
    {
      module: 'stakeholders',
      name: 'Stakeholder engagement',
      description: stakeholders.length > 0 ? `${stakeholders.length} stakeholder groups identified` : 'Identify and prioritize key stakeholders',
      progress: stakeholders.length > 0 ? 100 : 0,
    },
    {
      module: 'sample-size',
      name: 'Sample size',
      description: sampleParameters?.base_sample_size ? `${sampleParameters.base_sample_size} respondents per group` : 'Set a statistically sound survey sample',
      progress: sampleParameters ? 100 : 0,
    },
    {
      module: 'questionnaire',
      name: 'External assessment',
      description:
        materialTopics.length === 0
          ? 'Add topics and record stakeholder responses'
          : `${withResponses} of ${materialTopics.length} topics have stakeholder responses`,
      progress: external,
    },
    {
      module: 'internal-assessment',
      name: 'Internal assessment',
      description: internalTopics.length > 0 ? `${internalTopics.length} topics rated` : 'Rate business impact by severity and likelihood',
      progress: internalTopics.length > 0 ? 100 : 0,
    },
    {
      module: 'reporting',
      name: 'Report',
      description: reports.length > 0 ? `${reports.length} report${reports.length === 1 ? '' : 's'} finalized` : 'Finalize the assessment and log it to Hedera',
      progress: reports.length > 0 ? 100 : 0,
    },
  ];
  return { steps, overall: Math.round(steps.reduce((sum, s) => sum + s.progress, 0) / steps.length) };
}

export const SCORE_LABELS = ['Very low', 'Low', 'Medium', 'High', 'Very high'] as const;

export function categoryBadgeClass(category: TopicCategory): string {
  switch (category) {
    case 'Environmental':
      return 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
    case 'Social':
      return 'border-transparent bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200';
    default:
      return 'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200';
  }
}
