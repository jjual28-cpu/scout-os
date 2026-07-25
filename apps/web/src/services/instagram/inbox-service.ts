import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * 인박스 메시지 저장 — 웹훅(수신)·발송 라우트(발신)가 쓴다. service_role.
 * 중복 mid 는 무시(웹훅 재전송 대비).
 */

export type SaveMessageInput = {
  userId: string;
  peerId: string;
  peerUsername?: string | null;
  direction: 'in' | 'out';
  text: string | null;
  mid?: string | null;
};

export async function saveMessage(input: SaveMessageInput): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('instagram_messages').upsert(
    {
      user_id: input.userId,
      peer_id: input.peerId,
      peer_username: input.peerUsername ?? null,
      direction: input.direction,
      text: input.text,
      mid: input.mid ?? null,
      // 내가 보낸 건 읽은 것으로 취급, 받은 건 미읽음.
      is_read: input.direction === 'out',
    },
    { onConflict: 'mid', ignoreDuplicates: true },
  );
  // mid 가 null 이면 onConflict 가 안 걸리므로 그냥 insert 된다(발신은 mid 없어도 됨).
  if (error) throw new Error(`인스타 메시지 저장 실패: ${error.message}`);
}

/**
 * 셀럽이 답장을 보내면 그 셀럽의 CRM 상태를 '답변옴'(= '답변' 스테이지)으로 옮긴다.
 * 웹훅(수신)에서 호출. service_role 로 RLS 우회.
 *
 * 원칙:
 *  - 연락 기록이 이미 있는 셀럽만 옮긴다(허깨비 카드 방지 — 처음 DM 온 사람은 인박스에만).
 *  - 이미 '협업'·'제외' 같이 더 진행된 단계면 되돌리지 않고, 답장 표시(reply_status)만 남긴다.
 *  - creator_id 는 discovered_creators.external_id 규칙과 동일한 `instagram:<username>`.
 *    (인스타 아이디는 항상 소문자 → toLowerCase 로 안전하게 맞춘다.)
 */
export async function markCreatorReplied(userId: string, peerUsername: string): Promise<void> {
  const handle = peerUsername.trim().replace(/^@/, '').toLowerCase();
  if (!handle) return;
  const creatorId = `instagram:${handle}`;
  const admin = createAdminClient();

  const { data } = await admin
    .from('outreach_activities')
    .select('status')
    .eq('user_id', userId)
    .eq('creator_id', creatorId)
    .maybeSingle();
  if (!data) return; // 연락 기록 없음 → 인박스에만 남기고 CRM 카드는 만들지 않는다

  const cur = (data as { status?: string | null }).status ?? null;
  const patch =
    cur === '협업' || cur === '제외'
      ? { reply_status: '답변옴' } // 더 진행된 단계는 유지, 답장 왔다는 표시만
      : { status: '답변옴', reply_status: '답변옴', follow_up_at: null }; // 답장 왔으니 후속 예약 해제

  const { error } = await admin
    .from('outreach_activities')
    .update(patch)
    .eq('user_id', userId)
    .eq('creator_id', creatorId);
  if (error) throw new Error(`답변 상태 이동 실패: ${error.message}`);
}
