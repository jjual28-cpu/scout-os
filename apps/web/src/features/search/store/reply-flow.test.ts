import { afterEach, describe, expect, it } from 'vitest';

import { buildThreads, type InboxMessage } from '@/features/inbox/hooks/use-inbox';
import { buildReplyMap, replyKey } from '@/features/search/hooks/use-inbox-reply-map';

import { getSnapshot, markRepliedFromInbox, removeRecord, updateRecord } from './outreach-store';

/**
 * 답장 → CRM '답변' 자동이동 파이프라인 검증.
 *
 * 실제 앱에서 <ReplyReconciler/> 가 하는 일을 React 없이 그대로 재현한다:
 *   인박스 메시지 → buildThreads → buildReplyMap → (연락기록 있으면) markRepliedFromInbox
 * 스토어는 기본 local 모드(jsdom localStorage)라 Supabase 없이 결정론적으로 돈다.
 */

// 각 테스트가 만든 레코드를 정리해 스토어 전역 상태 오염을 막는다.
const created = new Set<string>();
function seed(creatorId: string, patch: Parameters<typeof updateRecord>[1]) {
  updateRecord(creatorId, patch);
  created.add(creatorId);
}
afterEach(() => {
  for (const id of created) removeRecord(id);
  created.clear();
  window.localStorage.clear();
});

const rec = (id: string) => getSnapshot().records[id];

describe('markRepliedFromInbox — 답장 상태 이동', () => {
  it('연락한 셀럽이 답장하면 CRM 을 "답변옴"으로 전진시키고 후속 예약을 해제한다', () => {
    seed('instagram:foo', {
      status: '연락완료',
      contactedAt: '2026-08-10T00:00:00Z',
      followUpAt: '2026-08-20',
    });

    markRepliedFromInbox('instagram:foo', '관심 있어요!');

    const r = rec('instagram:foo');
    expect(r?.status).toBe('답변옴');
    expect(r?.replyStatus).toBe('답변옴');
    expect(r?.followUpAt).toBeNull();
    expect(r?.replyNote).toBe('관심 있어요!'); // 비어 있던 메모는 실제 답장으로 채움
  });

  it('이미 협업으로 확정한 건은 되돌리지 않고 답장 표시만 남긴다', () => {
    seed('instagram:bar', { status: '협업' });

    markRepliedFromInbox('instagram:bar', '넵 진행해요');

    const r = rec('instagram:bar');
    expect(r?.status).toBe('협업'); // 더 진행된 단계 유지
    expect(r?.replyStatus).toBe('답변옴'); // 답장 왔다는 표시만
  });

  it('제외 처리한 건도 status 를 유지한다', () => {
    seed('instagram:baz', { status: '제외' });
    markRepliedFromInbox('instagram:baz', '나중에요');
    expect(rec('instagram:baz')?.status).toBe('제외');
    expect(rec('instagram:baz')?.replyStatus).toBe('답변옴');
  });

  it('연락 기록이 없는 셀럽은 유령 카드를 만들지 않는다', () => {
    markRepliedFromInbox('instagram:ghost', '먼저 연락온 사람');
    expect(rec('instagram:ghost')).toBeUndefined();
  });

  it('이미 "답변옴"이면 아무것도 바꾸지 않는다(idempotent)', () => {
    seed('instagram:dup', { status: '연락완료', replyStatus: '답변옴', replyNote: '첫 답장' });
    markRepliedFromInbox('instagram:dup', '두번째 답장');
    const r = rec('instagram:dup');
    expect(r?.status).toBe('연락완료'); // 전진 안 함
    expect(r?.replyNote).toBe('첫 답장'); // 덮어쓰지 않음
  });

  it('사용자가 남긴 수동 메모(replyNote)는 보존한다', () => {
    seed('instagram:memo', { status: '연락완료', replyNote: '중요 고객' });
    markRepliedFromInbox('instagram:memo', '자동으로 들어온 답장 본문');
    expect(rec('instagram:memo')?.replyNote).toBe('중요 고객');
  });
});

describe('전체 파이프라인 — 인박스 메시지에서 CRM 반영까지', () => {
  let seq = 0;
  function msg(
    p: Partial<InboxMessage> & { peerId: string; direction: 'in' | 'out' },
  ): InboxMessage {
    seq += 1;
    return {
      id: `m${seq}`,
      peerId: p.peerId,
      peerUsername: p.peerUsername ?? null,
      direction: p.direction,
      text: p.text ?? null,
      isRead: p.isRead ?? false,
      createdAt: p.createdAt ?? `2026-08-11T00:00:${String(seq).padStart(2, '0')}Z`,
    };
  }

  /** ReplyReconciler 의 조정 로직을 그대로 재현한다. */
  function reconcile(messages: InboxMessage[]) {
    const map = buildReplyMap(buildThreads(messages));
    const byKey = new Map<string, string>();
    for (const id of Object.keys(getSnapshot().records)) byKey.set(replyKey(id), id);
    for (const [key, reply] of map) {
      const actualId = byKey.get(key);
      if (!actualId) continue; // 연락한 적 없는 셀럽 → CRM 반영 안 함
      markRepliedFromInbox(actualId, reply.text);
    }
  }

  it('연락한 셀럽 답장만 CRM 에 반영하고, 확정건 보호 + 유령카드 방지가 함께 동작한다', () => {
    // 연락 기록: foo(연락완료), bar(협업 확정). ghost 는 연락한 적 없음.
    seed('instagram:foo', { status: '연락완료', followUpAt: '2026-08-20' });
    seed('instagram:bar', { status: '협업' });

    reconcile([
      msg({ peerId: '1', peerUsername: 'Foo', direction: 'out', text: '제안' }),
      msg({ peerId: '1', peerUsername: 'Foo', direction: 'in', text: '좋아요 참여할게요' }),
      msg({ peerId: '2', peerUsername: 'BAR', direction: 'in', text: '넵' }),
      msg({ peerId: '3', peerUsername: 'ghost', direction: 'in', text: '처음 연락드려요' }),
    ]);

    // foo: 대소문자 달라도(Foo→instagram:foo) 매칭되어 답변으로 전진
    expect(rec('instagram:foo')?.status).toBe('답변옴');
    expect(rec('instagram:foo')?.followUpAt).toBeNull();
    // bar: 협업 유지 + 답장 표시
    expect(rec('instagram:bar')?.status).toBe('협업');
    expect(rec('instagram:bar')?.replyStatus).toBe('답변옴');
    // ghost: 연락기록 없으니 카드 생성 안 됨
    expect(rec('instagram:ghost')).toBeUndefined();
  });
});
