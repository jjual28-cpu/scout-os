'use client';

import { useMemo, useSyncExternalStore } from 'react';

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

/**
 * 메시지 목록 → 상대(peer)별 스레드. 최근 메시지 순으로 정렬한다.
 * 훅(useInbox)과 테스트가 공유하는 순수 함수 — React·Supabase 의존 없음.
 */
export function buildThreads(messages: InboxMessage[]): InboxThread[] {
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
}

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

// ---------------------------------------------------------------------------
// Shared store — ONE poller for the whole app.
//
// 이전엔 useInbox 가 컴포넌트별 useState+setInterval 이라, 사이드바·알림벨·인박스·
// CRM·상세·드로어·캠페인상세가 각자 15초마다 instagram_messages 를 따로 조회했다.
// 여기서 모듈 단일 스냅샷 + 단일 폴러로 묶어(useSyncExternalStore), 소비자가 몇이든
// 폴링은 한 번만 돈다. 첫 구독 때 시작하고 마지막 구독 해제 때 멈춘다.
// ---------------------------------------------------------------------------
type Snapshot = { messages: InboxMessage[]; hydrated: boolean };

let snapshot: Snapshot = { messages: [], hydrated: false };
const SERVER_SNAPSHOT: Snapshot = { messages: [], hydrated: false };
const listeners = new Set<() => void>();

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
let enabled = false; // Supabase + 로그인 확인됨(쓰기 가능)

function emit() {
  listeners.forEach((l) => l());
}
function set(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch };
  emit();
}

/** 인박스 메시지를 다시 불러온다(폴링 + 수동 새로고침 공용). */
export async function reloadInbox(): Promise<void> {
  if (!isSupabaseConfigured()) {
    set({ hydrated: true });
    return;
  }
  try {
    const sb = createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      set({ hydrated: true });
      return;
    }
    enabled = true;
    const { data } = await sb
      .from('instagram_messages')
      .select('*')
      .order('created_at', { ascending: true });
    set({ messages: (data ?? []).map(rowToMsg), hydrated: true });
  } catch {
    set({ hydrated: true });
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!started) {
    started = true;
    void reloadInbox();
    timer = setInterval(() => void reloadInbox(), POLL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
      started = false;
    }
  };
}
function getSnapshot(): Snapshot {
  return snapshot;
}
function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

/** 그 스레드의 받은 메시지를 읽음 처리(RLS self_update). 낙관적. */
export async function markInboxRead(peerId: string): Promise<void> {
  set({
    messages: snapshot.messages.map((m) =>
      m.peerId === peerId && m.direction === 'in' ? { ...m, isRead: true } : m,
    ),
  });
  if (!enabled) return;
  try {
    await createClient()
      .from('instagram_messages')
      .update({ is_read: true })
      .eq('peer_id', peerId)
      .eq('direction', 'in');
  } catch {
    /* 다음 폴링에서 정정 */
  }
}

/**
 * 어드민 인박스 데이터. 셀럽 답장이 웹훅으로 들어오면 여기 뜬다(폴링 15s, 앱 전체 1회).
 * mock/미구성/로그아웃 → 빈 상태. 반환 형태는 이전과 동일(threads·unreadTotal·hydrated·
 * reload·markRead)이라 모든 소비자가 그대로 동작한다.
 */
export function useInbox() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const threads = useMemo<InboxThread[]>(() => buildThreads(snap.messages), [snap.messages]);

  const unreadTotal = useMemo(
    () => snap.messages.filter((m) => m.direction === 'in' && !m.isRead).length,
    [snap.messages],
  );

  return {
    threads,
    unreadTotal,
    hydrated: snap.hydrated,
    reload: reloadInbox,
    markRead: markInboxRead,
  };
}
