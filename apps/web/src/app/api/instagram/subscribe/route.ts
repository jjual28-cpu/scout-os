import { type NextRequest } from 'next/server';

import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isInstagramConfigured, isSupabaseConfigured } from '@/lib/env';
import { subscribeMessagingWebhook } from '@/services/instagram/messaging';
import { getValidToken } from '@/services/instagram/oauth';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * POST /api/instagram/subscribe — 메시지 웹훅 재구독(복구용).
 * OAuth 직후 구독이 실패했을 때 설정에서 다시 시도한다. Auth 필요.
 */
export const POST = withErrorHandling(async (_request: NextRequest) => {
  if (!isSupabaseConfigured() || !isInstagramConfigured()) {
    return fail('UNAVAILABLE', '인스타가 구성되지 않았습니다.', 503);
  }

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  const token = await getValidToken(userId);
  if (!token) return fail('IG_NOT_CONNECTED', '인스타가 연동되지 않았습니다.', 409);

  const sub = await subscribeMessagingWebhook(token.igUserId, token.accessToken);
  if (!sub.ok) return fail('IG_SUBSCRIBE_FAILED', sub.error ?? '웹훅 구독에 실패했어요.', 422);

  return ok({ subscribed: true });
});
