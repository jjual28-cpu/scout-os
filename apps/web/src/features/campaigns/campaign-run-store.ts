'use client';

/**
 * Tiny shared store for in-flight campaign searches.
 *
 * The global poller (mounted in AppShell) writes statuses here as it advances
 * each running campaign; Discover subscribes so it can refresh the moment its
 * campaign finishes — without either side owning the polling loop.
 */
export type RunStatus = 'running' | 'succeeded' | 'failed';

/** Stage progress for an in-flight search (derived server-side from apify_stage). */
export type RunDetail = { stage: number; progress: number; message: string };

type Snapshot = {
  /** campaignId → latest known status. */
  statuses: Record<string, RunStatus>;
  /** campaignId → current stage/progress while running. */
  details: Record<string, RunDetail>;
  /** Bumped whenever any campaign transitions — lets subscribers re-read. */
  tick: number;
  /** The campaign that most recently finished (for the completion toast). */
  justFinished: {
    id: string;
    status: 'succeeded' | 'failed';
    query: string;
    resultCount: number;
  } | null;
};

let snapshot: Snapshot = { statuses: {}, details: {}, tick: 0, justFinished: null };
const SERVER_SNAPSHOT: Snapshot = { statuses: {}, details: {}, tick: 0, justFinished: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getSnapshot(): Snapshot {
  return snapshot;
}
export function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

/** Record a campaign's status. Emits only on an actual change. */
export function setRunStatus(id: string, status: RunStatus, query = '', resultCount = 0): void {
  const prev = snapshot.statuses[id];
  if (prev === status) return;
  const finished =
    status !== 'running' ? { id, status, query, resultCount } : snapshot.justFinished;
  snapshot = {
    ...snapshot,
    statuses: { ...snapshot.statuses, [id]: status },
    tick: snapshot.tick + 1,
    justFinished: finished,
  };
  emit();
}

/** Record stage/progress for a running campaign (drives the stage tracker). */
export function setRunDetail(id: string, detail: RunDetail): void {
  const prev = snapshot.details[id];
  if (prev && prev.stage === detail.stage && prev.progress === detail.progress) return;
  snapshot = {
    ...snapshot,
    details: { ...snapshot.details, [id]: detail },
    tick: snapshot.tick + 1,
  };
  emit();
}

/** Dismiss the completion toast. */
export function clearJustFinished(): void {
  if (!snapshot.justFinished) return;
  snapshot = { ...snapshot, justFinished: null, tick: snapshot.tick + 1 };
  emit();
}
