'use client';

import { useCallback, useSyncExternalStore } from 'react';

import * as store from '../store/outreach-store';

/**
 * Per-creator outreach activity + follow-up tracking. Backed by Supabase
 * (`outreach_activities`) when configured + signed in, else localStorage.
 */
export function useOutreach() {
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  const get = useCallback(
    (creatorId: string) => snapshot.records[creatorId] ?? store.emptyRecord(creatorId),
    [snapshot.records],
  );

  /** Creators whose follow-up date is today or overdue (and not 제외). */
  const followUpsDueToday = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    return Object.values(snapshot.records)
      .filter((r) => r.followUpAt && r.followUpAt <= today && r.status !== '제외')
      .sort((a, b) => (a.followUpAt ?? '').localeCompare(b.followUpAt ?? ''));
  }, [snapshot.records]);

  return {
    records: snapshot.records,
    hydrated: snapshot.hydrated,
    get,
    followUpsDueToday,
    setStatus: store.setStatus,
    setStageSafe: store.setStageSafe,
    setNote: store.setNote,
    setDmDraft: store.setDmDraft,
    setFollowUpAt: store.setFollowUpAt,
    markContacted: store.markContacted,
    setReply: store.setReply,
    removeRecord: store.removeRecord,
  };
}
