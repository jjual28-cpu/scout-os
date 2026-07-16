import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';
import { runAi } from '@/services/ai/run';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * POST /api/ai/test — run a tiny real AI call to verify the platform is working
 * (key + model + balance). Counts against the caller's daily limit like any AI
 * call, so it can't be used to bypass the cap.
 */
export const POST = withErrorHandling(async () => {
  if (!isSupabaseConfigured()) return fail('UNAVAILABLE', '서버가 구성되지 않았습니다.', 503);

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  const text = await runAi(userId, {
    prompt: '연결 테스트입니다. "연결됨"이라고만 답해 주세요.',
    maxTokens: 20,
    temperature: 0,
  });

  return ok({ ok: true, sample: text.trim().slice(0, 60) });
});
