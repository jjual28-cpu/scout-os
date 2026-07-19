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
