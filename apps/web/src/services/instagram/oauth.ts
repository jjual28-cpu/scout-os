import 'server-only';

import { env } from '@/lib/env';

import { getConnection, saveConnection } from './connection-service';

/**
 * 인스타 로그인(Instagram API with Instagram Login) OAuth — 서버 전용.
 * 셀럽 답장을 수신·응답하려면 오너의 프로 계정 access_token 이 필요하다.
 *
 * 흐름: authorize → code → 단기 토큰(+user_id) → 장기 토큰(60일) → me(username).
 * 토큰·secret 은 절대 브라우저에 노출하지 않는다.
 */

export const INSTAGRAM_SCOPE = 'instagram_business_basic,instagram_business_manage_messages';

/** 만료 임박(1일 이내)이면 refresh. 장기 토큰은 60일, 갱신 가능. */
const REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;

/** 사용자를 보낼 인스타 승인 URL. */
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', env.INSTAGRAM_APP_ID ?? '');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', INSTAGRAM_SCOPE);
  url.searchParams.set('state', state);
  return url.toString();
}

/* eslint-disable @typescript-eslint/no-explicit-any -- external API JSON */
async function readJson(res: Response): Promise<any> {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      json?.error_message ||
      json?.error?.message ||
      json?.error ||
      `인스타 인증 오류 (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : '인스타 인증에 실패했습니다.');
  }
  return json;
}

type ExchangeResult = {
  igUserId: string;
  username: string | null;
  accessToken: string;
  tokenExpiresAt: string | null;
};

/** 승인 code → 장기 토큰 + 계정 정보. (저장은 호출측에서 saveConnection) */
export async function exchangeCode(code: string, redirectUri: string): Promise<ExchangeResult> {
  const appId = env.INSTAGRAM_APP_ID;
  const secret = env.INSTAGRAM_APP_SECRET;
  if (!appId || !secret) throw new Error('인스타 앱 키가 설정되지 않았습니다.');

  // 1) code → 단기 토큰 (+ user_id)
  const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: secret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }).toString(),
  });
  const short = await readJson(shortRes);
  const shortToken: string = short?.access_token;
  const igUserId = String(short?.user_id ?? short?.user?.id ?? '');
  if (!shortToken || !igUserId) throw new Error('인스타 토큰 응답이 올바르지 않습니다.');

  // 2) 단기 → 장기 토큰 (60일)
  const longUrl = new URL('https://graph.instagram.com/access_token');
  longUrl.searchParams.set('grant_type', 'ig_exchange_token');
  longUrl.searchParams.set('client_secret', secret);
  longUrl.searchParams.set('access_token', shortToken);
  const long = await readJson(await fetch(longUrl.toString()));
  const accessToken: string = long?.access_token ?? shortToken;
  const expiresIn = Number(long?.expires_in);
  const tokenExpiresAt = Number.isFinite(expiresIn)
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  // 3) username 조회 (best-effort)
  let username: string | null = null;
  try {
    const meUrl = new URL('https://graph.instagram.com/me');
    meUrl.searchParams.set('fields', 'user_id,username');
    meUrl.searchParams.set('access_token', accessToken);
    const me = await readJson(await fetch(meUrl.toString()));
    username = typeof me?.username === 'string' ? me.username : null;
  } catch {
    /* username 은 없어도 됨 */
  }

  return { igUserId, username, accessToken, tokenExpiresAt };
}

/** 장기 토큰 갱신(60일 연장). */
async function refreshToken(
  accessToken: string,
): Promise<{ accessToken: string; expiresAt: string | null }> {
  const url = new URL('https://graph.instagram.com/refresh_access_token');
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', accessToken);
  const json = await readJson(await fetch(url.toString()));
  const expiresIn = Number(json?.expires_in);
  return {
    accessToken: json?.access_token ?? accessToken,
    expiresAt: Number.isFinite(expiresIn)
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** 저장된 연동에서 유효한 토큰을 얻는다(만료 임박이면 갱신·저장). 없으면 null. */
export async function getValidToken(
  userId: string,
): Promise<{ igUserId: string; accessToken: string } | null> {
  const conn = await getConnection(userId);
  if (!conn) return null;

  const exp = conn.tokenExpiresAt ? new Date(conn.tokenExpiresAt).getTime() : Infinity;
  if (exp - Date.now() > REFRESH_MARGIN_MS) {
    return { igUserId: conn.igUserId, accessToken: conn.accessToken };
  }
  try {
    const refreshed = await refreshToken(conn.accessToken);
    await saveConnection({
      ...conn,
      accessToken: refreshed.accessToken,
      tokenExpiresAt: refreshed.expiresAt,
    });
    return { igUserId: conn.igUserId, accessToken: refreshed.accessToken };
  } catch {
    // 갱신 실패해도 기존 토큰으로 시도(아직 안 만료됐을 수 있음).
    return { igUserId: conn.igUserId, accessToken: conn.accessToken };
  }
}
