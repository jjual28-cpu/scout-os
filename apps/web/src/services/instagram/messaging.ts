import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * 인스타 Messaging — 발송 + 웹훅 서명검증. 서버 전용.
 * 발송은 상대가 먼저 보낸 뒤 24시간 이내만 허용된다(그 밖이면 API가 거부 → 호출측이
 * 정직하게 실패 표시하고 ig.me 붙여넣기로 폴백).
 */

const GRAPH = 'https://graph.instagram.com/v21.0';

export type SendResult = { ok: boolean; messageId?: string; error?: string };

/* eslint-disable @typescript-eslint/no-explicit-any -- external API JSON */
/** recipient(IGSID)에게 텍스트 DM 전송. */
export async function sendMessage(
  igUserId: string,
  accessToken: string,
  recipientId: string,
  text: string,
): Promise<SendResult> {
  const res = await fetch(`${GRAPH}/${encodeURIComponent(igUserId)}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error?.message || `인스타 발송 오류 (${res.status})`;
    return { ok: false, error: typeof msg === 'string' ? msg : '발송 실패' };
  }
  return { ok: true, messageId: json?.message_id };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * 이 계정의 메시지 웹훅을 앱에 구독시킨다 — OAuth 직후 1회 필요.
 * 이 호출을 안 하면 연동을 해도 셀럽 답장이 웹훅으로 안 들어온다(Instagram Login API).
 * best-effort: 실패해도 연동 자체는 유지하고, 설정 카드의 "답장 수신 재연결"로 재시도 가능.
 * @returns 구독 성공 여부(success 필드).
 */
export async function subscribeMessagingWebhook(
  igUserId: string,
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = new URL(`${GRAPH}/${encodeURIComponent(igUserId)}/subscribed_apps`);
    url.searchParams.set('subscribed_fields', 'messages');
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url.toString(), { method: 'POST' });
    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      error?: { message?: string };
    } | null;
    if (!res.ok || json?.success === false) {
      const msg = json?.error?.message || `웹훅 구독 오류 (${res.status})`;
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '웹훅 구독 실패' };
  }
}

/** IGSID → username (best-effort). 실패하면 null (권한·버전 따라 없을 수 있음). */
export async function fetchPeerUsername(
  peerId: string,
  accessToken: string,
): Promise<string | null> {
  try {
    const url = new URL(`${GRAPH}/${encodeURIComponent(peerId)}`);
    url.searchParams.set('fields', 'username');
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as { username?: string } | null;
    return typeof json?.username === 'string' ? json.username : null;
  } catch {
    return null;
  }
}

/**
 * 웹훅 서명검증 — 위조 방지. Meta 는 X-Hub-Signature-256: sha256=<hex> 헤더로
 * app secret 을 키로 한 원문 HMAC 을 보낸다. 타이밍-세이프 비교.
 */
export function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader) return false;
  const expected =
    'sha256=' + createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
