import { randomUUID } from 'crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { isInstagramConfigured, isSupabaseConfigured } from '@/lib/env';
import { buildAuthorizeUrl } from '@/services/instagram/oauth';
import { appOrigin } from '@/services/instagram/origin';

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
  maxAge: 600,
};

/**
 * GET /api/instagram/authorize — 오너를 인스타 승인 화면으로 보낸다. state 쿠키로
 * CSRF 방지. 실패는 /settings?instagram=fail 로 되돌린다.
 */
export const GET = async (request: NextRequest) => {
  // 사용자가 접속한 호스트(apex/www)를 그대로 써서 시작·콜백·쿠키를 같은 호스트로 맞춘다.
  const origin = appOrigin(request);
  const back = (flag: string) => NextResponse.redirect(`${origin}/settings?instagram=${flag}`);

  if (!isInstagramConfigured() || !isSupabaseConfigured()) return back('unavailable');

  const sb = await getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return back('login');

  const state = randomUUID();
  const redirectUri = `${origin}/api/instagram/callback`;
  const res = NextResponse.redirect(buildAuthorizeUrl(redirectUri, state));
  res.cookies.set('ig_oauth_state', state, COOKIE_OPTS);
  return res;
};
