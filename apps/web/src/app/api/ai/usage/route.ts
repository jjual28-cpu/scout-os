import { ok, withErrorHandling } from '@/lib/api/response';
import { env, isAiPlatformConfigured, isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/** Asia/Seoul calendar date (KST has no DST, so UTC+9 gives the right day). */
function seoulToday(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * GET /api/ai/usage — today's AI usage for the signed-in user + the daily limit.
 * `ready` reflects whether the operator has configured the platform key (the
 * limit lives in a server env var, so the browser can't read it directly).
 */
export const GET = withErrorHandling(async () => {
  const limit = env.AI_DAILY_LIMIT;
  const ready = isAiPlatformConfigured();

  if (!isSupabaseConfigured()) return ok({ ready, used: 0, limit });

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return ok({ ready, used: 0, limit });

  const { data } = await sb
    .from('ai_usage')
    .select('calls')
    .eq('user_id', userId)
    .eq('usage_date', seoulToday())
    .maybeSingle();

  const used = (data as { calls: number } | null)?.calls ?? 0;
  return ok({ ready, used, limit });
});
