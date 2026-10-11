'use client';

import { Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAiStatus } from '@/hooks/use-api';

/** Shown in place of an AI feature when no AI provider is configured on the server. */
export function AiUnavailable({ feature }: { feature: string }) {
  const { data } = useAiStatus();
  if (!data || data.configured) return null;
  return (
    <Alert>
      <Sparkles className="h-4 w-4" />
      <AlertDescription>
        {feature} needs an AI provider. Set <code>ANTHROPIC_API_KEY</code> or <code>OPENAI_API_KEY</code> on the server to enable it.
      </AlertDescription>
    </Alert>
  );
}
