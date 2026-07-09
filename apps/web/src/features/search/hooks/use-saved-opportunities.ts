'use client';

import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_STATUS } from '../status';
import { type OpportunityStatus, type SavedOpportunity, type SearchResult } from '../types';

const SAVED_KEY = 'scout:saved-opportunities';
/** Same-tab change signal so every hook instance (cards, topbar, /saved) stays in sync. */
const SAVED_EVENT = 'scout:saved-changed';

/** Ensure a stored item has the classification fields (migrates older data). */
function normalize(raw: Partial<SavedOpportunity> & SearchResult): SavedOpportunity {
  return {
    ...raw,
    status: raw.status ?? DEFAULT_STATUS,
    note: raw.note ?? '',
    savedAt: raw.savedAt ?? 0,
  };
}

function readSaved(): SavedOpportunity[] {
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as SavedOpportunity[]).map(normalize);
  } catch {
    return [];
  }
}

function writeSaved(next: SavedOpportunity[]) {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
  // Notify all hook instances in this tab; 'storage' covers other tabs.
  window.dispatchEvent(new Event(SAVED_EVENT));
}

function toSaved(result: SearchResult): SavedOpportunity {
  return { ...result, status: DEFAULT_STATUS, note: '', savedAt: Date.now() };
}

/**
 * Persisted list of saved opportunities with per-item status + note. Reads fresh
 * from localStorage on every mutation to avoid stale-closure bugs, and broadcasts
 * changes so sibling instances re-render immediately. localStorage-only — no DB.
 */
export function useSavedOpportunities() {
  const [saved, setSaved] = useState<SavedOpportunity[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSaved(readSaved());
    setHydrated(true);

    const sync = () => setSaved(readSaved());
    window.addEventListener('storage', sync);
    window.addEventListener(SAVED_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SAVED_EVENT, sync);
    };
  }, []);

  const save = useCallback((item: SearchResult) => {
    const current = readSaved();
    if (current.some((s) => s.id === item.id)) return; // prevent duplicates
    writeSaved([toSaved(item), ...current]);
  }, []);

  const remove = useCallback((id: string) => {
    writeSaved(readSaved().filter((s) => s.id !== id));
  }, []);

  const toggle = useCallback((item: SearchResult) => {
    const current = readSaved();
    const exists = current.some((s) => s.id === item.id);
    writeSaved(exists ? current.filter((s) => s.id !== item.id) : [toSaved(item), ...current]);
  }, []);

  const setStatus = useCallback((id: string, status: OpportunityStatus) => {
    writeSaved(readSaved().map((s) => (s.id === id ? { ...s, status } : s)));
  }, []);

  const setNote = useCallback((id: string, note: string) => {
    writeSaved(readSaved().map((s) => (s.id === id ? { ...s, note } : s)));
  }, []);

  const clear = useCallback(() => writeSaved([]), []);

  const isSaved = useCallback((id: string) => saved.some((s) => s.id === id), [saved]);

  return {
    saved,
    count: saved.length,
    hydrated,
    isSaved,
    save,
    remove,
    toggle,
    setStatus,
    setNote,
    clear,
  };
}
