import 'server-only';

import { env } from '@/lib/env';

import { getConnection, saveConnection } from './connection-service';

/**
 * 카페24 OAuth 2.0 (authorization code) — 서버 전용.
 *   1. buildAuthorizeUrl: 사용자를 카페24 승인 화면으로 보낼 URL
 *   2. exchangeCode: 승인 code → access/refresh 토큰
 *   3. getValidAccessToken: 저장된 토큰을 쓰되, 만료 임박이면 refresh 후 저장
 *
 * client_id/secret 은 env(CAFE24_*) 에서만 읽고 브라우저에 절대 노출하지 않는다.
 * 토큰 만료 시각은 카페24 응답의 expires_at(타임존 표기가 모호) 대신 요청 시점
 * 기준으로 보수적으로 계산한다 — access ~2시간, refresh ~2주.
 */

export const CAFE24_SCOPE = 'mall.read_product';

/** access_token 유효기간을 보수적으로 잡는다(실제 2시간, 여유 두고 110분). */
const ACCESS_TTL_MS = 110 * 60 * 1000;
/** refresh_token 유효기간(실제 약 2주, 여유 두고 13일). */
const REFRESH_TTL_MS = 13 * 24 * 60 * 60 * 1000;

function tokenEndpoint(mallId: string): string {
  return `https://${mallId}.cafe24api.com/api/v2/oauth/token`;
}

function basicAuth(): string {
  const id = env.CAFE24_CLIENT_ID;
  const secret = env.CAFE24_CLIENT_SECRET;
  if (!id || !secret)
    throw new Error('카페24 앱 키(CAFE24_CLIENT_ID/SECRET)가 설정되지 않았습니다.');
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
}

/** 사용자를 보낼 카페24 승인 URL. state 로 CSRF 방지. */
export function buildAuthorizeUrl(mallId: string, redirectUri: string, state: string): string {
  const url = new URL(`https://${mallId}.cafe24api.com/api/v2/oauth/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', env.CAFE24_CLIENT_ID ?? '');
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', CAFE24_SCOPE);
  return url.toString();
}

/** mall_id 는 subdomain 이 되므로 안전한 형태만 허용(주입 방지). */
export function isValidMallId(mallId: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,60}$/i.test(mallId);
}

type NormalizedTokens = Omit<import('./connection-service').Cafe24Connection, 'userId'>;

/* eslint-disable @typescript-eslint/no-explicit-any -- external API JSON */
async function tokenRequest(mallId: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(tokenEndpoint(mallId), {
    method: 'POST',
    headers: {
      Authorization: basicAuth(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error_description || json?.error || `카페24 인증 오류 (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

function normalizeTokens(mallId: string, json: any): NormalizedTokens {
  const now = Date.now();
  const accessToken = json?.access_token;
  const refreshToken = json?.refresh_token;
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
    throw new Error('카페24 토큰 응답이 올바르지 않습니다.');
  }
  const scopes = Array.isArray(json?.scopes)
    ? json.scopes.join(',')
    : typeof json?.scopes === 'string'
      ? json.scopes
      : null;
  return {
    mallId: json?.mall_id || mallId,
    accessToken,
    refreshToken,
    expiresAt: new Date(now + ACCESS_TTL_MS).toISOString(),
    refreshTokenExpiresAt: new Date(now + REFRESH_TTL_MS).toISOString(),
    scopes,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** 승인 code → 토큰. (저장은 호출측에서 saveConnection 으로.) */
export async function exchangeCode(
  mallId: string,
  code: string,
  redirectUri: string,
): Promise<NormalizedTokens> {
  const json = await tokenRequest(mallId, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  return normalizeTokens(mallId, json);
}

/** refresh_token 으로 access_token 재발급. */
export async function refreshTokens(
  mallId: string,
  refreshToken: string,
): Promise<NormalizedTokens> {
  const json = await tokenRequest(mallId, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  return normalizeTokens(mallId, json);
}

/**
 * 저장된 연동에서 유효한 access_token 을 얻는다. 만료가 1분 이내면 refresh 후 저장.
 * 연동이 없으면 null (호출측이 "미연동" 처리).
 */
export async function getValidAccessToken(
  userId: string,
): Promise<{ mallId: string; accessToken: string } | null> {
  const conn = await getConnection(userId);
  if (!conn) return null;

  const remaining = new Date(conn.expiresAt).getTime() - Date.now();
  if (remaining > 60_000) {
    return { mallId: conn.mallId, accessToken: conn.accessToken };
  }

  const refreshed = await refreshTokens(conn.mallId, conn.refreshToken);
  await saveConnection({ userId, ...refreshed });
  return { mallId: refreshed.mallId, accessToken: refreshed.accessToken };
}
