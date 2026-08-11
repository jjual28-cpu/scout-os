'use client';

import { useMemo } from 'react';

import { type InboxThread, useInbox } from '@/features/inbox/hooks/use-inbox';

/** 한 셀럽에게서 받은 최신 답장(인박스에서 파생). */
export type CreatorReply = {
  /** outreach creatorId 형식 `instagram:<username소문자>`. */
  creatorId: string;
  peerId: string;
  peerUsername: string;
  /** 마지막으로 '받은' 메시지 본문. */
  text: string;
  /** 그 메시지 시각(ISO). */
  at: string;
  /** 이 스레드의 안 읽은 수신 수. */
  unread: number;
};

/** creatorId 를 인박스 매칭용 키로 정규화(`instagram:Foo` → `instagram:foo`). */
export function replyKey(creatorId: string): string {
  return creatorId.toLowerCase();
}

/**
 * 인스타 인박스(웹훅 수집) 스레드를 outreach creatorId 로 이어 주는 맵.
 * `peer_username` 이 있는 스레드만, 마지막 '수신' 메시지를 기준으로 만든다.
 * 셀럽이 답장하면 CRM 카드·상세 페이지가 인스타에 들어가지 않고도 이 답장을 자동 표시한다.
 */
/**
 * 인박스 스레드 → creatorId별 최신 답장 맵. 훅과 테스트가 공유하는 순수 함수.
 * `peer_username` 이 있고 마지막 '수신(in)' 메시지가 있는 스레드만 포함한다.
 */
export function buildReplyMap(threads: InboxThread[]): Map<string, CreatorReply> {
  const m = new Map<string, CreatorReply>();
  for (const t of threads) {
    if (!t.peerUsername) continue; // username 없으면 creatorId 매칭 불가
    // 마지막 '수신(in)' 메시지 — 없으면(우리가 보내기만 함) 표시할 답장이 없음.
    let lastIn: (typeof t.messages)[number] | null = null;
    for (const msg of t.messages) {
      if (msg.direction === 'in') lastIn = msg;
    }
    if (!lastIn) continue;
    const creatorId = `instagram:${t.peerUsername.toLowerCase()}`;
    m.set(creatorId, {
      creatorId,
      peerId: t.peerId,
      peerUsername: t.peerUsername,
      text: lastIn.text ?? '',
      at: lastIn.createdAt,
      unread: t.unread,
    });
  }
  return m;
}

export function useInboxReplyMap(): { map: Map<string, CreatorReply>; hydrated: boolean } {
  const { threads, hydrated } = useInbox();
  const map = useMemo(() => buildReplyMap(threads), [threads]);
  return { map, hydrated };
}
