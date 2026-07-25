'use client';

import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

/**
 * Per-creator outreach activity (status, DM, contact + follow-up history).
 * Keyed by creatorId = discovered_creators.external_id (e.g. "instagram:username").
 *
 * Same runtime backend selection as the saved-opportunities store:
 *   - Supabase configured AND signed in → `outreach_activities` (synced, RLS)
 *   - otherwise (mock mode)             → localStorage
 * Read via `useOutreach` (useSyncExternalStore); mutations are optimistic.
 */

export type OutreachRecord = {
  creatorId: string;
  /** Free-text stage/status (ContactStatus or CRM Stage value). */
  status: string;
  note: string;
  dmDraft: string;
  contactedAt: string | null;
  followUpAt: string | null; // 'YYYY-MM-DD'
  replyStatus: string | null;
  replyNote: string;
  contactCount: number;
};

type RecordMap = Record<string, OutreachRecord>;
type Snapshot = { records: RecordMap; hydrated: boolean };

const KEY = 'scout:outreach-activities';

/** 연락 완료 후 자동으로 잡히는 후속(follow-up) 간격(일). 답장을 놓치지 않게 한다. */
const FOLLOW_UP_DAYS = 3;
/** 오늘 기준 days일 뒤의 'YYYY-MM-DD'. followUpsDueToday 와 같은 UTC 기준으로 맞춘다. */
function isoDatePlus(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

let snapshot: Snapshot = { records: {}, hydrated: false };
const SERVER_SNAPSHOT: Snapshot = { records: {}, hydrated: false };
const listeners = new Set<() => void>();

let mode: 'local' | 'supabase' = 'local';
let userId: string | null = null;
let started = false;

let sb: ReturnType<typeof createClient> | null = null;
function sbClient() {
  if (!sb) sb = createClient();
  return sb;
}

function emit() {
  listeners.forEach((l) => l());
}
function setSnapshot(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch };
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  void start();
  return () => {
    listeners.delete(listener);
  };
}
export function getSnapshot(): Snapshot {
  return snapshot;
}
export function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

export function emptyRecord(creatorId: string): OutreachRecord {
  return {
    creatorId,
    status: '미검토',
    note: '',
    dmDraft: '',
    contactedAt: null,
    followUpAt: null,
    replyStatus: null,
    replyNote: '',
    contactCount: 0,
  };
}

// ---------------------------------------------------------------------------
// localStorage backend
// ---------------------------------------------------------------------------
function readLocal(): RecordMap {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecordMap) : {};
  } catch {
    return {};
  }
}
function writeLocal(records: RecordMap) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Supabase backend
// ---------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any -- DB rows are loosely typed */
function rowToRecord(r: any): OutreachRecord {
  return {
    creatorId: r.creator_id,
    status: r.status ?? '미검토',
    note: r.note ?? '',
    dmDraft: r.dm_draft ?? '',
    contactedAt: r.contacted_at ?? null,
    followUpAt: r.follow_up_at ?? null,
    replyStatus: r.reply_status ?? null,
    replyNote: r.reply_note ?? '',
    contactCount: r.contact_count ?? 0,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function recordToRow(r: OutreachRecord, uid: string) {
  return {
    user_id: uid,
    creator_id: r.creatorId,
    status: r.status,
    note: r.note || null,
    dm_draft: r.dmDraft || null,
    contacted_at: r.contactedAt,
    follow_up_at: r.followUpAt,
    reply_status: r.replyStatus,
    reply_note: r.replyNote || null,
    contact_count: r.contactCount,
  };
}

function run(query: PromiseLike<{ error: unknown }>): void {
  Promise.resolve(query).then(
    (res) => {
      if (res.error) console.error('[scout] outreach write failed:', res.error);
    },
    (err) => console.error('[scout] outreach write threw:', err),
  );
}

async function start() {
  if (started) return;
  started = true;

  if (!isSupabaseConfigured()) {
    mode = 'local';
    setSnapshot({ records: readLocal(), hydrated: true });
    return;
  }
  try {
    const supabase = sbClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await applyUser(user?.id ?? null);
    supabase.auth.onAuthStateChange((_e, session) => {
      void applyUser(session?.user?.id ?? null);
    });
  } catch {
    mode = 'local';
    setSnapshot({ records: readLocal(), hydrated: true });
  }
}

async function applyUser(uid: string | null) {
  userId = uid;
  if (!uid) {
    mode = 'local';
    setSnapshot({ records: readLocal(), hydrated: true });
    return;
  }
  mode = 'supabase';
  try {
    const { data } = await sbClient()
      .from('outreach_activities')
      .select(
        'creator_id,status,note,dm_draft,contacted_at,follow_up_at,reply_status,reply_note,contact_count',
      );
    const records: RecordMap = {};
    for (const row of data ?? []) {
      const rec = rowToRecord(row);
      records[rec.creatorId] = rec;
    }
    setSnapshot({ records, hydrated: true });
  } catch {
    setSnapshot({ hydrated: true });
  }
}

// ---------------------------------------------------------------------------
// Mutations (optimistic; then persisted)
// ---------------------------------------------------------------------------
function persist(record: OutreachRecord) {
  if (mode === 'local') {
    writeLocal(snapshot.records);
    return;
  }
  if (mode === 'supabase' && userId) {
    run(
      sbClient()
        .from('outreach_activities')
        .upsert(recordToRow(record, userId), { onConflict: 'user_id,creator_id' }),
    );
  }
}

/** Merge a patch into a creator's record (creating it if absent) and persist. */
export function updateRecord(creatorId: string, patch: Partial<OutreachRecord>) {
  const current = snapshot.records[creatorId] ?? emptyRecord(creatorId);
  const next: OutreachRecord = { ...current, ...patch, creatorId };
  setSnapshot({ records: { ...snapshot.records, [creatorId]: next } });
  persist(next);
}

export function setStatus(creatorId: string, status: string) {
  updateRecord(creatorId, { status });
}

/** 한 크리에이터의 연락 기록을 완전히 삭제. (CRM에서 '삭제'할 때 저장 목록과 함께 지운다) */
export function removeRecord(creatorId: string) {
  if (!(creatorId in snapshot.records)) return;
  const next = { ...snapshot.records };
  delete next[creatorId];
  setSnapshot({ records: next });
  if (mode === 'local') {
    writeLocal(snapshot.records);
    return;
  }
  if (mode === 'supabase' && userId) {
    run(sbClient().from('outreach_activities').delete().eq('creator_id', creatorId));
  }
}

/**
 * Move a creator to a stage with OPTIMISTIC update + rollback. Returns false if
 * the Supabase write failed (caller shows a Korean error and the UI reverts).
 */
export async function setStageSafe(creatorId: string, status: string): Promise<boolean> {
  const prev = snapshot.records[creatorId];
  const base = prev ?? emptyRecord(creatorId);
  // '연락 완료'로 옮기면 후속일을 자동 예약(이미 있으면 유지), '답변'으로 옮기면 해제.
  let followUpAt = base.followUpAt;
  if (status === '연락완료' && !followUpAt) followUpAt = isoDatePlus(FOLLOW_UP_DAYS);
  else if (status === '답변옴') followUpAt = null;
  const optimistic: OutreachRecord = { ...base, status, followUpAt, creatorId };
  setSnapshot({ records: { ...snapshot.records, [creatorId]: optimistic } });

  if (mode === 'local') {
    writeLocal(snapshot.records);
    return true;
  }
  if (mode === 'supabase' && userId) {
    try {
      const { error } = await sbClient()
        .from('outreach_activities')
        .upsert(recordToRow(optimistic, userId), { onConflict: 'user_id,creator_id' });
      if (error) throw error;
      return true;
    } catch {
      const next = { ...snapshot.records };
      if (prev) next[creatorId] = prev;
      else delete next[creatorId];
      setSnapshot({ records: next });
      return false;
    }
  }
  return true;
}
export function setNote(creatorId: string, note: string) {
  updateRecord(creatorId, { note });
}
export function setDmDraft(creatorId: string, dmDraft: string) {
  updateRecord(creatorId, { dmDraft });
}
export function setFollowUpAt(creatorId: string, followUpAt: string | null) {
  updateRecord(creatorId, { followUpAt });
}

/** Record a manual "연락 완료": stamp the time, bump the counter, advance status. */
export function markContacted(creatorId: string) {
  const current = snapshot.records[creatorId] ?? emptyRecord(creatorId);
  const replied = current.status === '답변옴';
  updateRecord(creatorId, {
    contactedAt: new Date().toISOString(),
    contactCount: current.contactCount + 1,
    status: replied ? '답변옴' : '연락완료',
    // 방금 연락했으니 후속 시계를 새로 건다(이미 답변 온 경우는 기존 값 유지).
    followUpAt: replied ? current.followUpAt : isoDatePlus(FOLLOW_UP_DAYS),
  });
}

/** Record that the creator replied. 답장이 왔으니 더 쫓을 필요가 없어 후속 예약은 해제. */
export function setReply(creatorId: string, replyNote: string) {
  updateRecord(creatorId, {
    replyStatus: '답변옴',
    replyNote,
    status: '답변옴',
    followUpAt: null,
  });
}
