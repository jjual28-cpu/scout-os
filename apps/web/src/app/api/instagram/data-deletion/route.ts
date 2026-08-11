import { createHash } from 'crypto';

import { type NextRequest, NextResponse } from 'next/server';

import { env, isInstagramConfigured } from '@/lib/env';
import { deleteConnection, resolveUserByIgId } from '@/services/instagram/connection-service';
import { deleteUserMessages } from '@/services/instagram/inbox-service';
import { parseSignedRequest } from '@/services/instagram/messaging';

export const dynamic = 'force-dynamic';

/**
 * Meta 데이터 삭제 요청 콜백 — App Review 필수. 사용자가 인스타/페이스북 설정에서
 * "앱이 보관한 내 정보 삭제"를 요청하면 Meta 가 signed_request 를 이 URL 로 POST 한다.
 * 우리는 그 사용자의 인스타 연동(토큰)과 대화 메시지를 삭제하고,
 * 진행 상태를 확인할 수 있는 { url, confirmation_code } 를 돌려줘야 한다.
 * https://developers.facebook.com/docs/development/create-an-app/data-deletion-callback
 */

/** signed_request → 삭제 실행. Meta 는 application/x-www-form-urlencoded 로 보낸다. */
export const POST = async (request: NextRequest) => {
  if (!isInstagramConfigured()) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  const signed = form?.get('signed_request');
  if (typeof signed !== 'string') {
    return NextResponse.json({ error: 'missing signed_request' }, { status: 400 });
  }

  const data = parseSignedRequest(signed, env.INSTAGRAM_APP_SECRET!);
  if (!data) return NextResponse.json({ error: 'bad signed_request' }, { status: 400 });

  // best-effort 삭제 — 연동이 있으면 토큰·대화까지 모두 제거. 응답은 항상 200 형식.
  try {
    const conn = await resolveUserByIgId(data.user_id);
    if (conn) {
      await deleteUserMessages(conn.userId);
      await deleteConnection(conn.userId);
    }
  } catch (err) {
    console.error(`[instagram] data-deletion purge failed: ${String(err)}`);
  }

  // 확인 코드: user_id + app secret 의 해시(결정적, 저장 불필요). 상태 조회 URL 로 안내.
  const code = createHash('sha256')
    .update(`${data.user_id}:${env.INSTAGRAM_APP_SECRET}`)
    .digest('hex')
    .slice(0, 16);
  const url = `${env.NEXT_PUBLIC_APP_URL}/api/instagram/data-deletion?code=${code}`;
  return NextResponse.json({ url, confirmation_code: code });
};

/** GET ?code= — 사용자가 삭제 진행 상태를 확인하는 페이지. */
export const GET = (request: NextRequest) => {
  const raw = new URL(request.url).searchParams.get('code') ?? '';
  const code = raw.replace(/[^a-f0-9]/gi, '').slice(0, 32); // XSS 방지: 16진수만
  const body = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>인스타그램 데이터 삭제</title></head><body style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:48px 24px;color:#0f172a;line-height:1.6"><h1 style="font-size:1.4rem">인스타그램 데이터 삭제 완료</h1><p>요청하신 인스타그램 연동 데이터(액세스 토큰 및 대화 메시지)가 삭제되었습니다.</p><p style="color:#64748b;font-size:.9rem">확인 코드: <code>${code}</code></p><p style="color:#64748b;font-size:.9rem">문의: <a href="mailto:jjual28@gmail.com">jjual28@gmail.com</a></p></body></html>`;
  return new NextResponse(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
};
