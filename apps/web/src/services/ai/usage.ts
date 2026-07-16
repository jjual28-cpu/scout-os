import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Per-user daily AI usage, enforced by the `bump_ai_usage` DB function (0010).
 * Writes go through the service-role client so the browser can never inflate or
 * reset its own count.
 */

/** Atomically record one AI call. Returns the new daily count, or -1 if over the limit. */
export async function bumpUsage(userId: string, limit: number): Promise<number> {
  const sb = createAdminClient();
  const { data, error } = await sb.rpc('bump_ai_usage', { p_user: userId, p_limit: limit });
  if (error) throw new Error(`AI 사용량 기록 실패: ${error.message}`);
  return typeof data === 'number' ? data : -1;
}
