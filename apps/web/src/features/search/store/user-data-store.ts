'use client';

import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

import { DEFAULT_STATUS } from '../status';
import { type OpportunityStatus, type SavedOpportunity, type SearchResult } from '../types';

/**
 * Single source of truth for the user's saved opportunities + DM drafts.
 *
 * Backend is chosen at runtime:
 *   - Supabase configured AND a user is signed in  → Supabase (synced per account)
 *   - otherwise (mock mode)                        → localStorage
 *
 * The public hooks (`useSavedOpportunities`, `useDmDrafts`) read this store via
 * `useSyncExternalStore`, so their external interface is unchanged. Mutations are
 * optimistic (update memory first, then persist) so the UI stays instant.
 */

type DraftMap = Record<string, string>;
type Snapshot = { saved: SavedOpportunity[]; drafts: DraftMap; hydrated: boolean };

const SAVED_KEY = 'scout:saved-opportunities';
const DRAFTS_KEY = 'scout:dm-drafts';
const MIGRATED_KEY = 'scout:migrated-to-supabase';

let snapshot: Snapshot = { saved: [], drafts: {}, hydrated: false };
const SERVER_SNAPSHOT: Snapshot = { saved: [], drafts: {}, hydrated: false };
const listeners = new Set<() => void>();

let mode: 'local' | 'supabase' = 'local';
let userId: string | null = null;
let started = false;

/** Cached browser Supabase client (only created when configured). */
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

// ---------------------------------------------------------------------------
// React store subscription (useSyncExternalStore)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// localStorage backend
// ---------------------------------------------------------------------------
function readLocalSaved(): SavedOpportunity[] {
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as SavedOpportunity[]).map((s) => ({
      ...s,
      status: s.status ?? DEFAULT_STATUS,
      note: s.note ?? '',
      savedAt: s.savedAt ?? 0,
    }));
  } catch {
    return [];
  }
}
function readLocalDrafts(): DraftMap {
  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY);
    return raw ? (JSON.parse(raw) as DraftMap) : {};
  } catch {
    return {};
  }
}
function writeLocalSaved(items: SavedOpportunity[]) {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}
function writeLocalDrafts(drafts: DraftMap) {
  try {
    window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Supabase backend (RLS scopes every query to the current user)
// ---------------------------------------------------------------------------
type SavedRow = {
  opportunity_id: string;
  status: OpportunityStatus;
  note: string | null;
  /** DB-authoritative save time. Mapped to `savedAt` — never written into raw_data. */
  created_at: string | null;
  raw_data: SavedOpportunity;
};

function savedToRow(item: SavedOpportunity, uid: string) {
  return {
    user_id: uid,
    opportunity_id: item.id,
    name: item.name,
    kind: item.type,
    platform: item.platform,
    reason: item.reason,
    score: item.opportunityScore,
    recommended_action: item.recommendedAction,
    status: item.status,
    note: item.note,
    raw_data: item,
  };
}
function rowToSaved(row: SavedRow): SavedOpportunity {
  // `savedAt` comes from the DB column, not from raw_data: created_at is server-set
  // and always present, whereas raw_data.savedAt is a client clock that older rows
  // may lack entirely. Fall back to raw_data only if the column is somehow null.
  const createdMs = row.created_at ? new Date(row.created_at).getTime() : NaN;
  const savedAt = Number.isFinite(createdMs) ? createdMs : (row.raw_data?.savedAt ?? 0);
  return { ...row.raw_data, status: row.status, note: row.note ?? '', savedAt };
}

/** The minimal shape of the signed-in Supabase user this store needs. */
type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string | null } | null;
};

/**
 * Execute a Supabase query builder and surface any error.
 *
 * IMPORTANT: postgrest builders are lazy — the HTTP request only fires when
 * `.then()` is called. `void builder` would build the query but never send it,
 * so mutations must go through here (which awaits) to actually persist.
 */
function run(query: PromiseLike<{ error: unknown }>): void {
  Promise.resolve(query).then(
    (res) => {
      if (res.error) console.error('[scout] Supabase write failed:', res.error);
    },
    (err) => console.error('[scout] Supabase write threw:', err),
  );
}

/**
 * Ensure a `profiles` row exists for the signed-in user (idempotent upsert).
 * Guarantees Authentication user ↔ profiles are linked even if the DB signup
 * trigger wasn't applied. RLS allows this because auth.uid() === id.
 */
async function ensureProfile(user: AuthUser) {
  try {
    const { error } = await sbClient()
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email ?? null,
          full_name: user.user_metadata?.full_name ?? null,
        },
        { onConflict: 'id' },
      );
    if (error) console.error('[scout] ensureProfile failed:', error);
  } catch (err) {
    console.error('[scout] ensureProfile threw:', err);
  }
}

// ---------------------------------------------------------------------------
// Startup + backend selection
// ---------------------------------------------------------------------------
async function start() {
  if (started) return;
  started = true;

  if (!isSupabaseConfigured()) {
    mode = 'local';
    setSnapshot({ saved: readLocalSaved(), drafts: readLocalDrafts(), hydrated: true });
    window.addEventListener('storage', () => {
      if (mode === 'local') setSnapshot({ saved: readLocalSaved(), drafts: readLocalDrafts() });
    });
    return;
  }

  try {
    const supabase = sbClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await applyUser(user ?? null);

    supabase.auth.onAuthStateChange((_event, session) => {
      void applyUser(session?.user ?? null);
    });
  } catch {
    // Any auth failure ⇒ fall back to local so the app still works.
    mode = 'local';
    setSnapshot({ saved: readLocalSaved(), drafts: readLocalDrafts(), hydrated: true });
  }
}

async function applyUser(user: AuthUser | null) {
  userId = user?.id ?? null;
  if (!user) {
    // Configured but signed out (protected routes redirect to /login anyway).
    mode = 'local';
    setSnapshot({ saved: readLocalSaved(), drafts: readLocalDrafts(), hydrated: true });
    return;
  }
  mode = 'supabase';
  await ensureProfile(user);
  await migrateLocalToSupabase(user.id);
  await loadFromSupabase();
}

async function loadFromSupabase() {
  try {
    const supabase = sbClient();
    const [savedRes, draftRes] = await Promise.all([
      supabase
        .from('saved_opportunities')
        .select('opportunity_id,status,note,created_at,raw_data')
        .order('created_at', { ascending: false }),
      supabase.from('dm_drafts').select('opportunity_id,content'),
    ]);

    const saved = (savedRes.data ?? []).map((r) => rowToSaved(r as unknown as SavedRow));
    const drafts: DraftMap = {};
    for (const d of draftRes.data ?? []) {
      drafts[(d as { opportunity_id: string }).opportunity_id] = (d as { content: string }).content;
    }
    setSnapshot({ saved, drafts, hydrated: true });
  } catch {
    setSnapshot({ hydrated: true });
  }
}

/**
 * One-time migration of existing localStorage data into Supabase after the first
 * login. Uses upsert with `ignoreDuplicates` so re-runs never duplicate, and
 * records a flag so it only happens once per browser.
 */
async function migrateLocalToSupabase(uid: string) {
  try {
    if (window.localStorage.getItem(MIGRATED_KEY)) return;

    const localSaved = readLocalSaved();
    const localDrafts = readLocalDrafts();

    if (localSaved.length === 0 && Object.keys(localDrafts).length === 0) {
      window.localStorage.setItem(MIGRATED_KEY, '1');
      return;
    }

    const supabase = sbClient();
    if (localSaved.length > 0) {
      await supabase.from('saved_opportunities').upsert(
        localSaved.map((s) => savedToRow(s, uid)),
        { onConflict: 'user_id,opportunity_id', ignoreDuplicates: true },
      );
    }
    if (Object.keys(localDrafts).length > 0) {
      await supabase.from('dm_drafts').upsert(
        Object.entries(localDrafts).map(([opportunity_id, content]) => ({
          user_id: uid,
          opportunity_id,
          content,
        })),
        { onConflict: 'user_id,opportunity_id', ignoreDuplicates: true },
      );
    }

    window.localStorage.setItem(MIGRATED_KEY, '1');
  } catch {
    // Never block the app on migration failure — it retries next login.
  }
}

// ---------------------------------------------------------------------------
// Mutations (optimistic in memory, then persisted to the active backend)
// ---------------------------------------------------------------------------
function toSaved(result: SearchResult): SavedOpportunity {
  return { ...result, status: DEFAULT_STATUS, note: '', savedAt: Date.now() };
}
function persistSaved() {
  if (mode === 'local') writeLocalSaved(snapshot.saved);
}
function persistDrafts() {
  if (mode === 'local') writeLocalDrafts(snapshot.drafts);
}

export function saveOpportunity(item: SearchResult) {
  if (snapshot.saved.some((s) => s.id === item.id)) return; // prevent duplicates
  const saved = toSaved(item);
  setSnapshot({ saved: [saved, ...snapshot.saved] });
  persistSaved();
  if (mode === 'supabase' && userId) {
    run(
      sbClient().from('saved_opportunities').upsert(savedToRow(saved, userId), {
        onConflict: 'user_id,opportunity_id',
        ignoreDuplicates: true,
      }),
    );
  }
}

export function removeOpportunity(id: string) {
  setSnapshot({ saved: snapshot.saved.filter((s) => s.id !== id) });
  persistSaved();
  if (mode === 'supabase' && userId) {
    run(sbClient().from('saved_opportunities').delete().eq('opportunity_id', id));
  }
}

export function toggleOpportunity(item: SearchResult) {
  if (snapshot.saved.some((s) => s.id === item.id)) removeOpportunity(item.id);
  else saveOpportunity(item);
}

export function setStatus(id: string, status: OpportunityStatus) {
  setSnapshot({ saved: snapshot.saved.map((s) => (s.id === id ? { ...s, status } : s)) });
  persistSaved();
  if (mode === 'supabase' && userId) {
    run(sbClient().from('saved_opportunities').update({ status }).eq('opportunity_id', id));
  }
}

export function setNote(id: string, note: string) {
  setSnapshot({ saved: snapshot.saved.map((s) => (s.id === id ? { ...s, note } : s)) });
  persistSaved();
  if (mode === 'supabase' && userId) {
    run(sbClient().from('saved_opportunities').update({ note }).eq('opportunity_id', id));
  }
}

export function clearSaved() {
  const ids = snapshot.saved.map((s) => s.id);
  setSnapshot({ saved: [] });
  persistSaved();
  if (mode === 'supabase' && userId && ids.length > 0) {
    run(sbClient().from('saved_opportunities').delete().in('opportunity_id', ids));
  }
}

export function setDraft(id: string, content: string) {
  setSnapshot({ drafts: { ...snapshot.drafts, [id]: content } });
  persistDrafts();
  if (mode === 'supabase' && userId) {
    run(
      sbClient()
        .from('dm_drafts')
        .upsert(
          { user_id: userId, opportunity_id: id, content },
          { onConflict: 'user_id,opportunity_id' },
        ),
    );
  }
}

export function removeDraft(id: string) {
  const next = { ...snapshot.drafts };
  delete next[id];
  setSnapshot({ drafts: next });
  persistDrafts();
  if (mode === 'supabase' && userId) {
    run(sbClient().from('dm_drafts').delete().eq('opportunity_id', id));
  }
}
