import { type NextRequest } from 'next/server';

import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isInstagramConfigured, isSupabaseConfigured } from '@/lib/env';
import { getConnection } from '@/services/instagram/connection-service';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * GET /api/instagram/status — 본인 인스타 연결 상태(토큰 제외). Auth 필요.
 */
export const GET = withErrorHandling(async (_request: NextRequest) => {
  if (!isSupabaseConfigured()) return ok({ configured: false, connected: false, username: null });

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  if (!isInstagramConfigured()) return ok({ configured: false, connected: false, username: null });

  const conn = await getConnection(userId);
  return ok({ configured: true, connected: Boolean(conn), username: conn?.username ?? null });
});
