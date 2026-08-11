import { type NextRequest, NextResponse } from 'next/server';

import { env, isInstagramConfigured } from '@/lib/env';
import { deleteConnection, resolveUserByIgId } from '@/services/instagram/connection-service';
import { parseSignedRequest } from '@/services/instagram/messaging';

export const dynamic = 'force-dynamic';

/**
 * Meta Deauthorize 콜백 — App Review 필수. 사용자가 인스타 설정에서 우리 앱을 제거하면
 * Meta 가 signed_request 를 이 URL 로 POST 한다. 토큰은 더는 유효하지 않으므로 저장된
 * 연동정보(토큰)를 삭제한다. 대화 메시지(CRM 이력)는 남긴다 — 완전 삭제는 데이터 삭제 콜백.
 * Meta 는 빠른 200 을 기대하므로 어떤 경우든 200 으로 응답(에러는 로그).
 */
export const POST = async (request: NextRequest) => {
  if (!isInstagramConfigured()) return NextResponse.json({ ok: true });

  const form = await request.formData().catch(() => null);
  const signed = form?.get('signed_request');
  if (typeof signed !== 'string') return NextResponse.json({ ok: true });

  const data = parseSignedRequest(signed, env.INSTAGRAM_APP_SECRET!);
  if (!data) return NextResponse.json({ ok: true });

  try {
    const conn = await resolveUserByIgId(data.user_id);
    if (conn) await deleteConnection(conn.userId);
  } catch (err) {
    console.error(`[instagram] deauthorize failed: ${String(err)}`);
  }
  return NextResponse.json({ ok: true });
};
