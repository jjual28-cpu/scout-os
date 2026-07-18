import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * 카페24 OAuth 연동 저장소. 토큰은 민감정보라 service_role 클라이언트로만
 * 읽고 쓴다 (cafe24_connections 는 RLS on + self 정책 없음 = 클라이언트 차단).
 */

export type Cafe24Connection = {
  userId: string;
  mallId: string;
  accessToken: string;
  refreshToken: string;
  /** access_token 만료 시각(ISO). */
  expiresAt: string;
  /** refresh_token 만료 시각(ISO) 또는 null. */
  refreshTokenExpiresAt: string | null;
  scopes: string | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- DB rows are loosely typed */
function rowToConnection(r: any): Cafe24Connection {
  return {
    userId: r.user_id,
    mallId: r.mall_id,
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiresAt: r.expires_at,
    refreshTokenExpiresAt: r.refresh_token_expires_at ?? null,
    scopes: r.scopes ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** 본인 연동을 조회 (없으면 null). */
export async function getConnection(userId: string): Promise<Cafe24Connection | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('cafe24_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`카페24 연동 조회 실패: ${error.message}`);
  return data ? rowToConnection(data) : null;
}

/** 연동 저장(upsert). 최초 연동·토큰 갱신 모두 여기로. */
export async function saveConnection(conn: Cafe24Connection): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('cafe24_connections').upsert(
    {
      user_id: conn.userId,
      mall_id: conn.mallId,
      access_token: conn.accessToken,
      refresh_token: conn.refreshToken,
      expires_at: conn.expiresAt,
      refresh_token_expires_at: conn.refreshTokenExpiresAt,
      scopes: conn.scopes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw new Error(`카페24 연동 저장 실패: ${error.message}`);
}

/** 연동 해제. */
export async function deleteConnection(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('cafe24_connections').delete().eq('user_id', userId);
  if (error) throw new Error(`카페24 연동 해제 실패: ${error.message}`);
}
