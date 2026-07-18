import { type NextRequest, NextResponse } from 'next/server';

import { env, isCafe24Configured, isSupabaseConfigured } from '@/lib/env';
import { saveConnection } from '@/services/cafe24/connection-service';
import { exchangeCode, isValidMallId } from '@/services/cafe24/oauth';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * GET /api/cafe24/callback — 카페24가 승인 후 code+state 로 리다이렉트한다.
 * 쿠키의 state 와 대조(CSRF)하고, 쿠키의 mall_id(외부 파라미터 신뢰 X)로
 * code→토큰 교환 후 연동을 저장한다. 끝나면 /products 로 되돌린다.
 */
export const GET = async (request: NextRequest) => {
  const back = (flag: 'connected' | 'fail') => {
    const res = NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/products?cafe24=${flag}`);
    // 일회용 OAuth 쿠키 정리
    res.cookies.delete('cafe24_oauth_state');
    res.cookies.delete('cafe24_oauth_mall');
    return res;
  };

  try {
    if (!isCafe24Configured() || !isSupabaseConfigured()) return back('fail');

    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    const cookieState = request.cookies.get('cafe24_oauth_state')?.value;
    const mallId = request.cookies.get('cafe24_oauth_mall')?.value;

    // state 대조 + mall_id 검증. 하나라도 어긋나면 중단.
    if (!code || !state || !cookieState || state !== cookieState) return back('fail');
    if (!mallId || !isValidMallId(mallId)) return back('fail');

    const sb = await getSupabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return back('fail');

    const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/cafe24/callback`;
    const tokens = await exchangeCode(mallId, code, redirectUri);
    await saveConnection({ userId: user.id, ...tokens });

    return back('connected');
  } catch (err) {
    console.error(`[cafe24] callback failed: ${String(err)}`);
    return back('fail');
  }
};
