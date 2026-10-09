// Row types for the tables in supabase/migrations. Shared by the browser and the server.

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  organization: string | null;
  wallet_address: string | null;
  hedera_account_id: string | null;
  test_hbar_granted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type InventorySource = 'calculator' | 'upload' | 'ai_extraction';

/** One activity line in an inventory, after emissions are computed. */
export interface InventoryLine {
  id: string;
  scope: 'Scope 1' | 'Scope 2';
  category: string;
  fuelCategory: string;
  fuelType: string;
  /** Quantity as entered or extracted, in `unit`. */
  quantity: number;
  unit: string;
  /** Quantity converted to the emission factor's native unit. */
  nativeQuantity: number;
  nativeUnit: string;
  /** kg CO2e per native unit. */
  factor: number;
  /** kg CO2e */
  emissions: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  /** Provenance for lines read from a document by the AI. */
  documentId?: string | null;
  evidence?: string | null;
  confidence?: number | null;
  /** True when a person changed a value the AI extracted. */
  edited?: boolean;
  description?: string | null;
}

export interface EmissionData {
  id: string;
  user_id: string;
  source: InventorySource;
  file_name: string | null;
  organization: string | null;
  reporting_period_start: string | null;
  reporting_period_end: string | null;
  total_emissions: number;
  breakdown: Record<string, number>;
  raw_data: unknown[];
  processed_data: InventoryLine[] | Record<string, unknown>[];
  status: 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface Certificate {
  id: string;
  user_id: string;
  emission_data_id: string;
  audit_id: string | null;
  certificate_id: string;
  title: string;
  organization: string | null;
  total_emissions: number;
  breakdown: Record<string, number>;
  status: 'issued' | 'partially_offset' | 'offset';
  issue_date: string;
  valid_until: string;
  data_hash: string;
  metadata_cid: string | null;
  metadata_pinned: boolean;
  nft_token_id: string | null;
  nft_serial: number | null;
  nft_tx_id: string | null;
  hcs_tx_id: string | null;
  hcs_sequence: number | null;
  offset_tonnes: number;
  created_at: string;
}

export interface CarbonCredit {
  id: string;
  slug: string;
  title: string;
  description: string;
  project_type: string;
  location: string;
  vintage: string;
  methodology: string | null;
  registry: string | null;
  registry_project_id: string | null;
  price_hbar: number;
  available: number;
  total_supply: number;
  image_url: string | null;
  project_details: Record<string, unknown>;
  created_at: string;
}

export type CreditGrade = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'C';

export interface CreditRating {
  credit_id: string;
  grade: CreditGrade;
  overall_score: number;
  scores: Record<string, { score: number; rationale: string }>;
  summary: string;
  strengths: string[];
  risks: string[];
  model: string | null;
  rating_hash: string;
  hcs_tx_id: string | null;
  hcs_sequence: number | null;
  created_at: string;
}

export type OrderStatus = 'awaiting_payment' | 'paid' | 'fulfilled' | 'failed' | 'expired';

export interface Order {
  id: string;
  user_id: string;
  credit_id: string;
  quantity: number;
  unit_price_hbar: number;
  total_tinybar: number;
  order_ref: string;
  status: OrderStatus;
  buyer_evm_address: string;
  buyer_account_id: string | null;
  payment_tx_hash: string | null;
  delivery_tx_id: string | null;
  hcs_tx_id: string | null;
  hcs_sequence: number | null;
  error: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface Retirement {
  id: string;
  user_id: string;
  certificate_id: string;
  amount: number;
  request_tx_hash: string;
  retiree_evm_address: string;
  retiree_account_id: string | null;
  wipe_tx_id: string | null;
  hcs_tx_id: string | null;
  hcs_sequence: number | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export type FindingSeverity = 'info' | 'low' | 'medium' | 'high';

export interface AuditFinding {
  id: string;
  check: string;
  severity: FindingSeverity;
  title: string;
  detail: string;
  lineIds: string[];
  recommendation: string;
}

export interface AuditCheckResult {
  check: string;
  label: string;
  passed: boolean;
}

export interface AiAudit {
  id: string;
  user_id: string;
  emission_data_id: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  summary: string;
  findings: AuditFinding[];
  checks: AuditCheckResult[];
  model: string | null;
  ruleset_version: string;
  audit_hash: string;
  hcs_tx_id: string | null;
  hcs_sequence: number | null;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  user_id: string;
  emission_data_id: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  storage_path: string | null;
  fingerprint: string | null;
  status: 'extracted' | 'failed';
  extraction: unknown;
  model: string | null;
  prompt_version: string | null;
  extraction_hash: string | null;
  hcs_tx_id: string | null;
  hcs_sequence: number | null;
  error: string | null;
  created_at: string;
}

export interface ReductionMeasure {
  id: string;
  title: string;
  description: string;
  targetCategory: string;
  scope: 'Scope 1' | 'Scope 2';
  /** Share of the targeted category's emissions this measure removes, 0-1. */
  reductionShare: number;
  /** tonnes CO2e per year, computed by the server from the inventory, not by the model. */
  annualReductionTonnes: number;
  capex: 'low' | 'medium' | 'high';
  paybackYears: number | null;
  difficulty: 'easy' | 'moderate' | 'hard';
  startYear: number;
  rationale: string;
}

export interface ReductionPlanContent {
  summary: string;
  baselineTonnes: number;
  targetYear: number;
  measures: ReductionMeasure[];
  trajectory: { year: number; baselineTonnes: number; projectedTonnes: number }[];
  totalAnnualReductionTonnes: number;
  reductionPercent: number;
  caveats: string[];
}

export interface ReductionPlan {
  id: string;
  user_id: string;
  emission_data_id: string;
  inputs: Record<string, unknown>;
  plan: ReductionPlanContent;
  model: string | null;
  plan_hash: string;
  hcs_tx_id: string | null;
  hcs_sequence: number | null;
  created_at: string;
}

export interface HcsAnchor {
  txId: string;
  sequence: number;
}

export interface GriDraftContent {
  summary: string;
  disclosures: { code: string; title: string; content: string; sources: string[] }[];
  dataGaps: string[];
}

export interface GriDraft {
  id: string;
  client_id: string;
  content: GriDraftContent;
  model: string | null;
  draft_hash: string;
  hcs_tx_id: string | null;
  hcs_sequence: number | null;
  created_at: string;
}
