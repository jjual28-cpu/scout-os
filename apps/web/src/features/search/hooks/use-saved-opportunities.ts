'use client';

import { useCallback, useSyncExternalStore } from 'react';

import * as store from '../store/user-data-store';

/**
 * Persisted list of saved opportunities with per-item status + note.
 *
 * The external interface is unchanged; internally it now reads from the shared
 * user-data store, which persists to Supabase when configured + signed in, and
 * to localStorage otherwise (mock mode).
 */
export function useSavedOpportunities() {
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const saved = snapshot.saved;

  const isSaved = useCallback((id: string) => saved.some((s) => s.id === id), [saved]);

  return {
    saved,
    count: saved.length,
    hydrated: snapshot.hydrated,
    isSaved,
    save: store.saveOpportunity,
    remove: store.removeOpportunity,
    toggle: store.toggleOpportunity,
    setStatus: store.setStatus,
    setNote: store.setNote,
    clear: store.clearSaved,
  };
}
