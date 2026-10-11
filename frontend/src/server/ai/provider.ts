import 'server-only';
import type * as z from 'zod/v4';
import { ConfigError, serverEnv } from '../env';

// One small interface for the five AI features. Every call asks for a JSON object validated against
// a zod schema, so feature code never parses free text. Anthropic (Claude) is used when
// ANTHROPIC_API_KEY is set, otherwise OpenAI when OPENAI_API_KEY is set.

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'pdf'; name: string; base64: string }
  | { type: 'image'; name: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; base64: string };

export interface StructuredRequest<S extends z.ZodType> {
  /** Short name of the calling feature, used in logs and errors. */
  feature: string;
  system: string;
  content: ContentPart[];
  schema: S;
  schemaName: string;
  /** Reasoning depth. Extraction and audits use 'high'; drafting uses 'medium'. */
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  provider: 'anthropic' | 'openai';
}

export interface AiProvider {
  name: 'anthropic' | 'openai';
  model: string;
  generate<S extends z.ZodType>(request: StructuredRequest<S>): Promise<StructuredResult<z.infer<S>>>;
}

export class AiOutputError extends Error {}

/**
 * 'reasoning' (audits, ratings, plans, advice, drafting) uses the main model. 'extraction' (reading bills)
 * can use a cheaper model: on the fixture bills a mini model transcribed exactly as accurately.
 */
export type AiWorkload = 'reasoning' | 'extraction';

const cached = new Map<AiWorkload, AiProvider>();

export async function aiProvider(workload: AiWorkload = 'reasoning'): Promise<AiProvider> {
  const existing = cached.get(workload);
  if (existing) return existing;
  let provider: AiProvider;
  if (serverEnv.anthropicApiKey()) {
    const { createAnthropicProvider } = await import('./anthropic');
    const model = workload === 'extraction' ? serverEnv.anthropicExtractionModel() : serverEnv.anthropicModel();
    provider = createAnthropicProvider(serverEnv.anthropicApiKey()!, model);
  } else if (serverEnv.openaiApiKey()) {
    const { createOpenAiProvider } = await import('./openai');
    const model = workload === 'extraction' ? serverEnv.openaiExtractionModel() : serverEnv.openaiModel();
    provider = createOpenAiProvider(serverEnv.openaiApiKey()!, model);
  } else {
    throw new ConfigError('No AI provider is configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local.');
  }
  cached.set(workload, provider);
  return provider;
}

export function aiConfigured(): boolean {
  return Boolean(serverEnv.anthropicApiKey() || serverEnv.openaiApiKey());
}
