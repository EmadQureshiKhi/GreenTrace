import 'server-only';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { ResponseInputContent } from 'openai/resources/responses/responses';
import type * as z from 'zod/v4';
import { AiOutputError, type AiProvider, type ContentPart, type StructuredRequest } from './provider';

function toInput(parts: ContentPart[]): ResponseInputContent[] {
  return parts.map((part): ResponseInputContent => {
    if (part.type === 'pdf') {
      return { type: 'input_file', filename: part.name, file_data: `data:application/pdf;base64,${part.base64}` };
    }
    if (part.type === 'image') {
      return { type: 'input_image', detail: 'high', image_url: `data:${part.mediaType};base64,${part.base64}` };
    }
    return { type: 'input_text', text: part.text };
  });
}

export function createOpenAiProvider(apiKey: string, model: string): AiProvider {
  const client = new OpenAI({ apiKey, baseURL: 'https://api.openai.com/v1', maxRetries: 2, timeout: 5 * 60_000 });

  return {
    name: 'openai',
    model,
    async generate<S extends z.ZodType>(request: StructuredRequest<S>) {
      const response = await client.responses.parse({
        model,
        instructions: request.system,
        input: [{ role: 'user', content: toInput(request.content) }],
        text: { format: zodTextFormat(request.schema, request.schemaName) },
        reasoning: { effort: request.effort ?? 'high' },
        max_output_tokens: request.maxTokens ?? 16_000,
      });

      if (response.status === 'incomplete') {
        throw new AiOutputError(`The ${request.feature} response was cut off (${response.incomplete_details?.reason ?? 'incomplete'}).`);
      }
      if (!response.output_parsed) {
        throw new AiOutputError(`The ${request.feature} response did not match the expected format.`);
      }
      return { data: response.output_parsed as z.infer<S>, model: response.model, provider: 'openai' as const };
    },
  };
}
