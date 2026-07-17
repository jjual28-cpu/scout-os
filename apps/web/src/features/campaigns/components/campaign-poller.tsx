'use client';

import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

import * as store from '../campaign-run-store';
import { listRunningCampaigns } from '../services/campaign-service';

const POLL_MS = 4000;

/**
 * Global Campaign Poller — mounted once in AppShell so an in-flight search keeps
 * advancing (Stage 1 → 2 → 3) while the user moves around the app.
 *
 * Each tick RE-DISCOVERS the running set from the DB and then advances each one.
 * This is deliberate: a brand-new search started after mount must be picked up
 * without a page reload. (The previous version only read the running set once at
 * mount, so a fresh search was never polled and got stuck on "검색 중" forever
 * even though its Apify run had already finished.)
 *
 * Limitation: this runs in the browser, so fully closing the tab pauses progress.
 * The next visit resumes it within one tick (no work is lost); the server also
 * fails a run that has been stuck too long so nothing stays "검색 중" forever.
 */
export function CampaignPoller() {
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const busy = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let alive = true;

    const tick = async () => {
      if (busy.current) return; // don't overlap slow ticks
      busy.current = true;
      try {
        const sb = createClient();
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user || !alive) return;

        // Re-read the running set every tick so newly-started searches are found.
        const rows = await listRunningCampaigns(sb, user.id);
        for (const r of rows) store.setRunStatus(r.id, 'running', r.query);

        // Advance each running campaign one step (starts the next Apify stage or
        // collects the finished dataset). Safe under duplicate polling via the
        // server's conditional stage claim.
        for (const c of rows) {
          if (!alive) return;
          const res = await fetch(`/api/campaigns/${c.id}/status`, { method: 'POST' });
          const json = (await res.json().catch(() => null)) as {
            data?: {
              status?: string;
              resultCount?: number;
              stage?: number;
              progress?: number;
              message?: string;
            };
          } | null;
          const d = json?.data;
          const status = d?.status;
          if (!alive) return;
          if (status === 'running' && d?.stage) {
            store.setRunDetail(c.id, {
              stage: d.stage,
              progress: d.progress ?? 0,
              message: d.message ?? '검색 중',
            });
          }
          if (status === 'succeeded' || status === 'failed') {
            store.setRunStatus(c.id, status, c.query, d?.resultCount ?? 0);
          }
        }
      } catch {
        /* ignore — next tick retries */
      } finally {
        busy.current = false;
      }
    };

    const id = setInterval(() => void tick(), POLL_MS);
    void tick();
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const finished = snap.justFinished;
  if (!finished) return null;

  const ok = finished.status === 'succeeded';
  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2">
      <div className="bg-card dark:border-border flex items-start gap-3 rounded-xl border border-slate-200/60 p-4 shadow-lg">
        <span className={ok ? 'text-emerald-600' : 'text-destructive'}>
          {ok ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {ok ? '검색이 완료되었습니다.' : '검색이 실패했습니다.'}
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {finished.query ? `‘${finished.query}’ · ` : ''}
            {ok ? `${finished.resultCount}명의 셀럽을 찾았습니다.` : '다시 검색해 주세요.'}
          </p>
          {/* Opens this exact campaign in Discover — restore only, no re-search.
              requestOpen() makes Discover reopen even if it's already mounted
              (a same-page ?campaign= change alone wouldn't trigger it); the href
              still handles navigating in from another page. */}
          <Button asChild size="sm" className="mt-2 h-7">
            <Link
              href={`/discover?campaign=${finished.id}`}
              onClick={() => {
                store.requestOpen(finished.id);
                store.clearJustFinished();
              }}
            >
              바로 보기
            </Link>
          </Button>
        </div>
        <button
          type="button"
          onClick={() => store.clearJustFinished()}
          aria-label="닫기"
          className="text-muted-foreground hover:text-foreground rounded p-0.5"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
