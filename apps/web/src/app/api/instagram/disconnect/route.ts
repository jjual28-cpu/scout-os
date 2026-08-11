import { type NextRequest } from 'next/server';

import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';
import { deleteConnection } from '@/services/instagram/connection-service';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * POST /api/instagram/disconnect — 오너가 설정에서 인스타 연동을 직접 해제한다.
 * 저장된 액세스 토큰·연동정보를 삭제(개인정보처리방침이 약속한 "설정에서 연결 해제").
 * 지난 대화 메시지는 남긴다(CRM 이력) — 완전 삭제는 데이터 삭제 요청 콜백에서 처리. Auth 필요.
 */
export const POST = withErrorHandling(async (_request: NextRequest) => {
  if (!isSupabaseConfigured()) return fail('UNAVAILABLE', '구성되지 않았습니다.', 503);

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  await deleteConnection(userId);
  return ok({ disconnected: true });
});
