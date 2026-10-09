import 'server-only';

// Server configuration. Read lazily so that `next build` works without secrets and a missing value
// fails the one request that needs it with a clear message instead of crashing the whole app.

export class ConfigError extends Error {}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new ConfigError(`${name} is not configured. Add it to .env.local (see .env.example).`);
  return value;
}

export const serverEnv = {
  supabaseUrl: () => required('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseServiceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),

  hederaOperatorId: () => required('HEDERA_OPERATOR_ID'),
  hederaOperatorKey: () => required('HEDERA_OPERATOR_KEY'),

  internalApiSecret: () => required('INTERNAL_API_SECRET'),

  pinataJwt: () => process.env.PINATA_JWT || null,

  anthropicApiKey: () => process.env.ANTHROPIC_API_KEY || null,
  anthropicModel: () => process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
  /** Model for bill reading (high volume, transcription); defaults to the main model. */
  anthropicExtractionModel: () => process.env.ANTHROPIC_EXTRACTION_MODEL || process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
  openaiApiKey: () => process.env.OPENAI_API_KEY || null,
  openaiModel: () => process.env.OPENAI_MODEL || 'gpt-5.5',
  openaiExtractionModel: () => process.env.OPENAI_EXTRACTION_MODEL || process.env.OPENAI_MODEL || 'gpt-5.5',
};
