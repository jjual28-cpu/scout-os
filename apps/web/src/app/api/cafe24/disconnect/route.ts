import { type NextRequest } from 'next/server';

import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';
import { deleteConnection } from '@/services/cafe24/connection-service';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * POST /api/cafe24/disconnect — 본인 카페24 연동을 해제한다(토큰 삭제).
 * 다른 몰로 다시 연결할 수 있도록 상태를 초기화. Auth 필요.
 */
export const POST = withErrorHandling(async (_request: NextRequest) => {
  if (!isSupabaseConfigured()) return fail('UNAVAILABLE', '서버가 구성되지 않았습니다.', 503);

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  await deleteConnection(userId);
  return ok({ disconnected: true });
});
