import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';
import { getCredentialKey, getCredentialModel } from '@/services/ai/credentials';
import { callGemini, DEFAULT_GEMINI_MODEL } from '@/services/ai/gemini';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * POST /api/ai/test — verify the stored key still works with a tiny call.
 * Reads the key server-side only; returns a short sample, never the key.
 */
export const POST = withErrorHandling(async () => {
  if (!isSupabaseConfigured()) return fail('UNAVAILABLE', '서버가 구성되지 않았습니다.', 503);

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  const key = await getCredentialKey(userId);
  if (!key) return fail('NOT_CONNECTED', '연결된 AI가 없습니다.', 400);

  const model = (await getCredentialModel(userId)) ?? DEFAULT_GEMINI_MODEL;
  const text = await callGemini(key, {
    prompt: '연결 테스트입니다. "연결됨"이라고만 답해 주세요.',
    model,
    maxTokens: 20,
    temperature: 0,
  });

  return ok({ ok: true, model, sample: text.trim().slice(0, 60) });
});
