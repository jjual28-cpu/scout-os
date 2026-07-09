'use client';

import { useCallback, useEffect, useState } from 'react';

const DRAFTS_KEY = 'scout:dm-drafts';
/** Same-tab change signal so every hook instance stays in sync. */
const DRAFTS_EVENT = 'scout:dm-drafts-changed';

/** Map of opportunity id → generated DM draft text. */
type DraftMap = Record<string, string>;

function readDrafts(): DraftMap {
  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY);
    return raw ? (JSON.parse(raw) as DraftMap) : {};
  } catch {
    return {};
  }
}

function writeDrafts(next: DraftMap) {
  try {
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
  window.dispatchEvent(new Event(DRAFTS_EVENT));
}

/**
 * Persists generated DM drafts in localStorage, keyed by opportunity id, so they
 * survive refreshes. No DB / API.
 */
export function useDmDrafts() {
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDrafts(readDrafts());
    setHydrated(true);

    const sync = () => setDrafts(readDrafts());
    window.addEventListener('storage', sync);
    window.addEventListener(DRAFTS_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(DRAFTS_EVENT, sync);
    };
  }, []);

  const setDraft = useCallback((id: string, text: string) => {
    writeDrafts({ ...readDrafts(), [id]: text });
  }, []);

  const removeDraft = useCallback((id: string) => {
    const next = readDrafts();
    delete next[id];
    writeDrafts(next);
  }, []);

  const getDraft = useCallback((id: string) => drafts[id], [drafts]);

  return { drafts, hydrated, getDraft, setDraft, removeDraft };
}
