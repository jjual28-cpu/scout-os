import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';
import { cancelAtPeriodEnd } from '@/services/billing/subscription-service';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/** POST /api/billing/cancel — stop future charges; keep access until period end. */
export const POST = withErrorHandling(async () => {
  if (!isSupabaseConfigured()) return fail('UNAVAILABLE', '서버가 구성되지 않았습니다.', 503);

  const sb = await getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  await cancelAtPeriodEnd(user.id);
  return ok({ ok: true });
});
