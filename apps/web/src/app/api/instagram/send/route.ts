import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isInstagramConfigured, isSupabaseConfigured } from '@/lib/env';
import { saveMessage } from '@/services/instagram/inbox-service';
import { sendMessage } from '@/services/instagram/messaging';
import { getValidToken } from '@/services/instagram/oauth';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  peerId: z.string().trim().min(1).max(100),
  peerUsername: z.string().max(120).nullish(),
  text: z.string().trim().min(1).max(1000),
});

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * POST /api/instagram/send — 셀럽에게 답장 전송(상대가 먼저 보낸 뒤 24시간 이내만
 * 인스타가 허용). 성공 시 발신 메시지 저장. 실패/창밖이면 에러(→UI가 ig.me 폴백).
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isSupabaseConfigured() || !isInstagramConfigured()) {
    return fail('UNAVAILABLE', '인스타가 구성되지 않았습니다.', 503);
  }

  const sb = await getSupabase();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  const body = bodySchema.parse(await request.json());

  const token = await getValidToken(userId);
  if (!token) return fail('IG_NOT_CONNECTED', '인스타가 연동되지 않았습니다.', 409);

  const result = await sendMessage(token.igUserId, token.accessToken, body.peerId, body.text);
  if (!result.ok) {
    // 24시간 창 밖·권한 등 — 정직하게 실패 반환(UI가 ig.me 붙여넣기 안내).
    return fail('IG_SEND_FAILED', result.error ?? '발송에 실패했어요.', 422);
  }

  await saveMessage({
    userId,
    peerId: body.peerId,
    peerUsername: body.peerUsername ?? null,
    direction: 'out',
    text: body.text,
    mid: result.messageId ?? null,
  });

  return ok({ sent: true });
});
