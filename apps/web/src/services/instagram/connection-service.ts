import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * 인스타 연동 저장소. 토큰은 민감정보라 service_role 로만 접근
 * (instagram_connections 는 RLS on + 정책 없음 = 클라이언트 차단).
 */

export type InstagramConnection = {
  userId: string;
  igUserId: string;
  username: string | null;
  accessToken: string;
  tokenExpiresAt: string | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- DB rows loosely typed */
function rowTo(r: any): InstagramConnection {
  return {
    userId: r.user_id,
    igUserId: r.ig_user_id,
    username: r.username ?? null,
    accessToken: r.access_token,
    tokenExpiresAt: r.token_expires_at ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function getConnection(userId: string): Promise<InstagramConnection | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('instagram_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`인스타 연동 조회 실패: ${error.message}`);
  return data ? rowTo(data) : null;
}

/** 웹훅용 — 프로 계정 IG id 로 어느 Scout OS 사용자인지 찾는다. */
export async function resolveUserByIgId(igUserId: string): Promise<InstagramConnection | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('instagram_connections')
    .select('*')
    .eq('ig_user_id', igUserId)
    .maybeSingle();
  return data ? rowTo(data) : null;
}

export async function saveConnection(conn: InstagramConnection): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('instagram_connections').upsert(
    {
      user_id: conn.userId,
      ig_user_id: conn.igUserId,
      username: conn.username,
      access_token: conn.accessToken,
      token_expires_at: conn.tokenExpiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw new Error(`인스타 연동 저장 실패: ${error.message}`);
}

export async function deleteConnection(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('instagram_connections').delete().eq('user_id', userId);
  if (error) throw new Error(`인스타 연동 해제 실패: ${error.message}`);
}
