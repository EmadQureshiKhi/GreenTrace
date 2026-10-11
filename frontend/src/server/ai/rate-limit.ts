import 'server-only';
import { HttpError } from '../http';
import { supabaseAdmin } from '../supabase-admin';

export type AiFeature = 'extract' | 'audit' | 'reduction-plan' | 'credit-rating' | 'offset-advisor' | 'gri-draft';

const LIMITS_PER_HOUR: Record<AiFeature, number> = {
  extract: 40,
  audit: 20,
  'reduction-plan': 10,
  'credit-rating': 20,
  'offset-advisor': 20,
  'gri-draft': 10,
};

/** Counts this request against the user's hourly allowance for the feature. */
export async function consumeAiQuota(userId: string, feature: AiFeature): Promise<void> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from('ai_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('feature', feature)
    .gte('created_at', since);
  if ((count ?? 0) >= LIMITS_PER_HOUR[feature]) {
    throw new HttpError(429, 'You have reached the hourly limit for this AI feature. Try again later.');
  }
  await db.from('ai_requests').insert({ user_id: userId, feature });
}
