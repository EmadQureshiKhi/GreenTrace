import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type * as z from 'zod/v4';
import { AiOutputError, type AiProvider, type ContentPart, type StructuredRequest } from './provider';

type BetaContent = Anthropic.Beta.Messages.BetaContentBlockParam;

function toBlocks(parts: ContentPart[]): BetaContent[] {
  // Documents and images go before the text that refers to them.
  const files: BetaContent[] = [];
  const text: BetaContent[] = [];
  for (const part of parts) {
    if (part.type === 'pdf') {
      files.push({ type: 'document', title: part.name, source: { type: 'base64', media_type: 'application/pdf', data: part.base64 } });
    } else if (part.type === 'image') {
      files.push({ type: 'image', source: { type: 'base64', media_type: part.mediaType, data: part.base64 } });
    } else {
      text.push({ type: 'text', text: part.text });
    }
  }
  return [...files, ...text];
}

export function createAnthropicProvider(apiKey: string, model: string): AiProvider {
  // The base URL is pinned so an ANTHROPIC_BASE_URL in the host environment can never redirect
  // the app's key elsewhere.
  const client = new Anthropic({ apiKey, baseURL: 'https://api.anthropic.com', maxRetries: 2, timeout: 5 * 60_000 });

  return {
    name: 'anthropic',
    model,
    async generate<S extends z.ZodType>(request: StructuredRequest<S>) {
      const response = await client.beta.messages.parse({
        model,
        max_tokens: request.maxTokens ?? 16_000,
        system: request.system,
        messages: [{ role: 'user', content: toBlocks(request.content) }],
        output_config: { format: betaZodOutputFormat(request.schema), effort: request.effort ?? 'high' },
        // If a safety classifier declines, the API retries on a suitable fallback model in the same call.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });

      if (response.stop_reason === 'refusal') {
        throw new AiOutputError(`The model declined the ${request.feature} request.`);
      }
      if (response.stop_reason === 'max_tokens') {
        throw new AiOutputError(`The ${request.feature} response was cut off. Try a smaller input.`);
      }
      if (!response.parsed_output) {
        throw new AiOutputError(`The ${request.feature} response did not match the expected format.`);
      }
      return { data: response.parsed_output as z.infer<S>, model: response.model, provider: 'anthropic' as const };
    },
  };
}
