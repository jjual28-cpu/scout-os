import { randomUUID } from 'crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { env, isInstagramConfigured, isSupabaseConfigured } from '@/lib/env';
import { buildAuthorizeUrl } from '@/services/instagram/oauth';

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
export const GET = async (_request: NextRequest) => {
  const back = (flag: string) =>
    NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/settings?instagram=${flag}`);

  if (!isInstagramConfigured() || !isSupabaseConfigured()) return back('unavailable');

  const sb = await getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return back('login');

  const state = randomUUID();
  const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/instagram/callback`;
  const res = NextResponse.redirect(buildAuthorizeUrl(redirectUri, state));
  res.cookies.set('ig_oauth_state', state, COOKIE_OPTS);
  return res;
};
