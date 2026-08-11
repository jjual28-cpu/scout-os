import { describe, expect, it } from 'vitest';

import { buildThreads, type InboxMessage } from '@/features/inbox/hooks/use-inbox';

import { buildReplyMap, replyKey } from './use-inbox-reply-map';

/**
 * 인박스(instagram_messages) → creatorId별 최신 답장 매핑 검증.
 * "셀럽이 답장하면 어떤 creatorId 로 이어지는가"의 순수 로직 — 웹훅/Supabase 무관.
 */

let seq = 0;
function msg(
  partial: Partial<InboxMessage> & { peerId: string; direction: 'in' | 'out' },
): InboxMessage {
  seq += 1;
  return {
    id: `m${seq}`,
    peerId: partial.peerId,
    peerUsername: partial.peerUsername ?? null,
    direction: partial.direction,
    text: partial.text ?? null,
    isRead: partial.isRead ?? false,
    // 순서를 보장하는 단조 증가 타임스탬프.
    createdAt: partial.createdAt ?? `2026-08-11T00:00:${String(seq).padStart(2, '0')}Z`,
  };
}

describe('replyKey', () => {
  it('creatorId 를 소문자로 정규화한다', () => {
    expect(replyKey('instagram:BeautyGuru')).toBe('instagram:beautyguru');
  });
});

describe('buildReplyMap', () => {
  it('받은 답장이 있는 스레드를 creatorId(소문자)로 매핑한다', () => {
    const threads = buildThreads([
      msg({ peerId: '100', peerUsername: 'BeautyGuru', direction: 'out', text: '협찬 제안드려요' }),
      msg({ peerId: '100', peerUsername: 'BeautyGuru', direction: 'in', text: '관심 있어요!' }),
    ]);
    const map = buildReplyMap(threads);

    const reply = map.get('instagram:beautyguru');
    expect(reply).toBeDefined();
    expect(reply?.text).toBe('관심 있어요!');
    expect(reply?.peerUsername).toBe('BeautyGuru');
  });

  it('여러 수신 메시지 중 마지막 것을 답장으로 쓴다', () => {
    const threads = buildThreads([
      msg({ peerId: '100', peerUsername: 'foo', direction: 'in', text: '누구세요?' }),
      msg({ peerId: '100', peerUsername: 'foo', direction: 'out', text: '체험단 안내입니다' }),
      msg({ peerId: '100', peerUsername: 'foo', direction: 'in', text: '네 참여할게요' }),
    ]);
    expect(buildReplyMap(threads).get('instagram:foo')?.text).toBe('네 참여할게요');
  });

  it('우리가 보내기만 한(수신 없는) 스레드는 제외한다', () => {
    const threads = buildThreads([
      msg({ peerId: '200', peerUsername: 'noreply', direction: 'out', text: '안녕하세요' }),
    ]);
    expect(buildReplyMap(threads).has('instagram:noreply')).toBe(false);
  });

  it('username 이 없는 스레드는 매칭 불가라 제외한다', () => {
    const threads = buildThreads([msg({ peerId: '300', direction: 'in', text: '답장' })]);
    expect(buildReplyMap(threads).size).toBe(0);
  });

  it('안 읽은 수신 수(unread)를 집계한다', () => {
    const threads = buildThreads([
      msg({ peerId: '400', peerUsername: 'creator', direction: 'in', text: '1', isRead: false }),
      msg({ peerId: '400', peerUsername: 'creator', direction: 'in', text: '2', isRead: false }),
    ]);
    expect(buildReplyMap(threads).get('instagram:creator')?.unread).toBe(2);
  });
});
