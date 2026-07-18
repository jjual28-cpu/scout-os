import { randomUUID } from 'crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { env, isCafe24Configured, isSupabaseConfigured } from '@/lib/env';
import { buildAuthorizeUrl, isValidMallId } from '@/services/cafe24/oauth';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 600, // 10분 — 승인 왕복 여유
};

/**
 * GET /api/cafe24/authorize?mall_id=… — 사용자를 카페24 승인 화면으로 보낸다.
 * CSRF 방지용 랜덤 state 와 mall_id 를 httpOnly 쿠키에 저장해 callback 에서 대조.
 * 실패(미구성·미로그인·잘못된 mall_id)는 /products?cafe24=fail 로 되돌린다.
 */
export const GET = async (request: NextRequest) => {
  const back = (flag: string) =>
    NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/products?cafe24=${flag}`);

  if (!isCafe24Configured() || !isSupabaseConfigured()) return back('unavailable');

  const mallId = (new URL(request.url).searchParams.get('mall_id') ?? '').trim().toLowerCase();
  if (!isValidMallId(mallId)) return back('badmall');

  const sb = await getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return back('login');

  const state = randomUUID();
  const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/cafe24/callback`;
  const authUrl = buildAuthorizeUrl(mallId, redirectUri, state);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set('cafe24_oauth_state', state, COOKIE_OPTS);
  res.cookies.set('cafe24_oauth_mall', mallId, COOKIE_OPTS);
  return res;
};
