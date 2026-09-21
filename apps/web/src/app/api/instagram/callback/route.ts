import { type NextRequest, NextResponse } from 'next/server';

import { isInstagramConfigured, isSupabaseConfigured } from '@/lib/env';
import { saveConnection } from '@/services/instagram/connection-service';
import { subscribeMessagingWebhook } from '@/services/instagram/messaging';
import { exchangeCode } from '@/services/instagram/oauth';
import { appOrigin } from '@/services/instagram/origin';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * GET /api/instagram/callback — 인스타가 승인 후 code+state 로 리다이렉트. state
 * 쿠키 대조 후 code→토큰 교환·저장. 끝나면 /settings 로.
 */
export const GET = async (request: NextRequest) => {
  // authorize 와 동일한 호스트(사용자가 접속한 apex/www)로 맞춘다 — redirect_uri 가
  // authorize 때와 정확히 같아야 토큰 교환이 되고, state·세션 쿠키도 같은 호스트라 읽힌다.
  const origin = appOrigin(request);
  const back = (flag: 'connected' | 'fail') => {
    const res = NextResponse.redirect(`${origin}/settings?instagram=${flag}`);
    res.cookies.delete('ig_oauth_state');
    return res;
  };

  try {
    if (!isInstagramConfigured() || !isSupabaseConfigured()) return back('fail');

    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const cookieState = request.cookies.get('ig_oauth_state')?.value;
    if (!code || !state || !cookieState || state !== cookieState) return back('fail');

    const sb = await getSupabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return back('fail');

    const redirectUri = `${origin}/api/instagram/callback`;
    const tokens = await exchangeCode(code, redirectUri);
    await saveConnection({ userId: user.id, ...tokens });

    // 이 계정의 메시지 웹훅을 앱에 구독 — 이게 있어야 셀럽 답장이 실제로 들어온다.
    // best-effort: 실패해도 연동은 성공 처리(설정의 "답장 수신 재연결"로 재시도 가능).
    const sub = await subscribeMessagingWebhook(tokens.igUserId, tokens.accessToken);
    if (!sub.ok) console.error(`[instagram] webhook subscribe failed: ${sub.error}`);

    return back('connected');
  } catch (err) {
    console.error(`[instagram] callback failed: ${String(err)}`);
    return back('fail');
  }
};
