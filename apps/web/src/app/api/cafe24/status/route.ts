import { type NextRequest } from 'next/server';

import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isCafe24Configured, isSupabaseConfigured } from '@/lib/env';
import { getConnection } from '@/services/cafe24/connection-service';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * GET /api/cafe24/status — 본인 카페24 연동 상태. 토큰은 절대 내려주지 않고
 * 연동 여부와 mall_id 만 반환한다. Auth 필요.
 */
export const GET = withErrorHandling(async (_request: NextRequest) => {
  if (!isSupabaseConfigured()) return ok({ configured: false, connected: false, mallId: null });

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  if (!isCafe24Configured()) return ok({ configured: false, connected: false, mallId: null });

  const conn = await getConnection(userId);
  return ok({ configured: true, connected: Boolean(conn), mallId: conn?.mallId ?? null });
});
