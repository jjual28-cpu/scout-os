import { type NextRequest, NextResponse } from 'next/server';

import { env, isInstagramConfigured, isSupabaseConfigured } from '@/lib/env';
import { saveConnection } from '@/services/instagram/connection-service';
import { exchangeCode } from '@/services/instagram/oauth';

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
  const back = (flag: 'connected' | 'fail') => {
    const res = NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/settings?instagram=${flag}`);
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

    const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/instagram/callback`;
    const tokens = await exchangeCode(code, redirectUri);
    await saveConnection({ userId: user.id, ...tokens });
    return back('connected');
  } catch (err) {
    console.error(`[instagram] callback failed: ${String(err)}`);
    return back('fail');
  }
};
