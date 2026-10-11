import { serverEnv } from '@/server/env';
import { route } from '@/server/http';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  if (serverEnv.anthropicApiKey()) return { configured: true, provider: 'anthropic', model: serverEnv.anthropicModel(), extractionModel: serverEnv.anthropicExtractionModel() };
  if (serverEnv.openaiApiKey()) return { configured: true, provider: 'openai', model: serverEnv.openaiModel(), extractionModel: serverEnv.openaiExtractionModel() };
  return { configured: false, provider: null, model: null };
});
