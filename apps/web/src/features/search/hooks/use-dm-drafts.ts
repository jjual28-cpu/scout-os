'use client';

import { useCallback, useSyncExternalStore } from 'react';

import * as store from '../store/user-data-store';

/**
 * Persists generated DM drafts, keyed by opportunity id.
 *
 * The external interface is unchanged; internally it reads from the shared
 * user-data store (Supabase when configured + signed in, localStorage otherwise).
 */
export function useDmDrafts() {
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const drafts = snapshot.drafts;

  const getDraft = useCallback((id: string) => drafts[id], [drafts]);

  return {
    drafts,
    hydrated: snapshot.hydrated,
    getDraft,
    setDraft: store.setDraft,
    removeDraft: store.removeDraft,
  };
}
