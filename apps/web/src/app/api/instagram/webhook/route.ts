import { type NextRequest, NextResponse } from 'next/server';

import { env, isInstagramConfigured } from '@/lib/env';
import { resolveUserByIgId } from '@/services/instagram/connection-service';
import { markCreatorReplied, saveMessage } from '@/services/instagram/inbox-service';
import { fetchPeerUsername, verifySignature } from '@/services/instagram/messaging';

export const dynamic = 'force-dynamic';

/**
 * GET /api/instagram/webhook — Meta 웹훅 검증. hub.verify_token 이 우리 것과
 * 일치하면 hub.challenge 를 그대로 에코(200). 인증 없음(Meta 호출).
 */
export const GET = (request: NextRequest) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && token === env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
};

/* eslint-disable @typescript-eslint/no-explicit-any -- webhook JSON */
/**
 * POST /api/instagram/webhook — 셀럽이 보낸 DM 이벤트. 서명검증 후 수신 메시지를
 * 저장한다. Meta 는 빠른 200 을 기대하므로 어떤 경우든 200 으로 응답(에러는 로그).
 */
export const POST = async (request: NextRequest) => {
  const raw = await request.text();

  // app secret 없으면(미구성) 조용히 200 — 재전송 폭주 방지.
  if (!isInstagramConfigured()) return NextResponse.json({ ok: true });

  const sig = request.headers.get('x-hub-signature-256');
  if (!verifySignature(raw, sig, env.INSTAGRAM_APP_SECRET!)) {
    // 위조/불일치 — 저장하지 않지만 200(Meta 재시도 방지). 로그만.
    console.error('[instagram] webhook signature mismatch');
    return NextResponse.json({ ok: true });
  }

  try {
    const body = JSON.parse(raw) as any;
    const entries: any[] = Array.isArray(body?.entry) ? body.entry : [];
    for (const entry of entries) {
      const events: any[] = Array.isArray(entry?.messaging) ? entry.messaging : [];
      for (const ev of events) {
        const msg = ev?.message;
        if (!msg || msg.is_echo) continue; // 내가 보낸 echo 는 건너뜀
        const text: string | undefined = typeof msg.text === 'string' ? msg.text : undefined;
        const businessId = String(ev?.recipient?.id ?? entry?.id ?? '');
        const peerId = String(ev?.sender?.id ?? '');
        if (!text || !businessId || !peerId) continue;

        const conn = await resolveUserByIgId(businessId);
        if (!conn) continue; // 우리 사용자 아님

        const peerUsername = await fetchPeerUsername(peerId, conn.accessToken);
        await saveMessage({
          userId: conn.userId,
          peerId,
          peerUsername,
          direction: 'in',
          text,
          mid: typeof msg.mid === 'string' ? msg.mid : null,
        });
        // 답장 온 셀럽을 CRM '답변' 칸으로 자동 이동(연락 기록 있는 경우만).
        if (peerUsername) await markCreatorReplied(conn.userId, peerUsername);
      }
    }
  } catch (err) {
    console.error(`[instagram] webhook processing failed: ${String(err)}`);
  }
  return NextResponse.json({ ok: true });
};
/* eslint-enable @typescript-eslint/no-explicit-any */
