'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

/** 인스타 대화 메시지(어드민 인박스). RLS 로 본인 것만. */
export type InboxMessage = {
  id: string;
  peerId: string;
  peerUsername: string | null;
  direction: 'in' | 'out';
  text: string | null;
  isRead: boolean;
  createdAt: string;
};

/** 상대별 스레드. */
export type InboxThread = {
  peerId: string;
  peerUsername: string | null;
  messages: InboxMessage[];
  last: InboxMessage;
  unread: number;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- DB rows loosely typed */
function rowToMsg(r: any): InboxMessage {
  return {
    id: r.id,
    peerId: r.peer_id,
    peerUsername: r.peer_username ?? null,
    direction: r.direction,
    text: r.text ?? null,
    isRead: r.is_read ?? false,
    createdAt: r.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const POLL_MS = 15000;

/**
 * 어드민 인박스 데이터. 셀럽 답장이 웹훅으로 들어오면 여기 뜬다(폴링 15s).
 * mock/미구성/로그아웃 → 빈 상태.
 */
export function useInbox() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const enabled = useRef(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setHydrated(true);
      return;
    }
    try {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) {
        setHydrated(true);
        return;
      }
      enabled.current = true;
      const { data } = await sb
        .from('instagram_messages')
        .select('*')
        .order('created_at', { ascending: true });
      setMessages((data ?? []).map(rowToMsg));
      setHydrated(true);
    } catch {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const threads = useMemo<InboxThread[]>(() => {
    const byPeer = new Map<string, InboxMessage[]>();
    for (const m of messages) {
      const list = byPeer.get(m.peerId) ?? [];
      list.push(m);
      byPeer.set(m.peerId, list);
    }
    const arr: InboxThread[] = [];
    for (const [peerId, list] of byPeer) {
      const last = list[list.length - 1]!;
      arr.push({
        peerId,
        peerUsername: list.find((m) => m.peerUsername)?.peerUsername ?? null,
        messages: list,
        last,
        unread: list.filter((m) => m.direction === 'in' && !m.isRead).length,
      });
    }
    // 최근 메시지 순.
    return arr.sort((a, b) => b.last.createdAt.localeCompare(a.last.createdAt));
  }, [messages]);

  const unreadTotal = useMemo(
    () => messages.filter((m) => m.direction === 'in' && !m.isRead).length,
    [messages],
  );

  /** 그 스레드의 받은 메시지를 읽음 처리(RLS self_update). 낙관적. */
  const markRead = useCallback(async (peerId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.peerId === peerId && m.direction === 'in' ? { ...m, isRead: true } : m)),
    );
    if (!enabled.current) return;
    try {
      await createClient()
        .from('instagram_messages')
        .update({ is_read: true })
        .eq('peer_id', peerId)
        .eq('direction', 'in');
    } catch {
      /* 다음 폴링에서 정정 */
    }
  }, []);

  return { threads, unreadTotal, hydrated, reload: load, markRead };
}
