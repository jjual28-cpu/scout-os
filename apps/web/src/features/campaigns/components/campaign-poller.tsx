'use client';

import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

import * as store from '../campaign-run-store';
import { listRunningCampaigns } from '../services/campaign-service';

const POLL_MS = 4000;

/**
 * Global Campaign Poller — mounted once in AppShell so an in-flight search keeps
 * advancing (Stage 1 → 2 → 3) while the user moves around CRM / Products /
 * Campaigns. Polls only while a running campaign exists and stops immediately on
 * succeeded/failed. Safe alongside Discover's own refresh: the server's
 * conditional stage claim guarantees each Actor starts exactly once.
 *
 * Limitation: this runs in the browser, so closing the tab pauses progress. The
 * status endpoint resumes the existing run on the next visit (no work is lost).
 */
export function CampaignPoller() {
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [running, setRunning] = useState<{ id: string; query: string }[]>([]);
  const busy = useRef(false);

  // Discover which campaigns are in flight (cheap; re-checked after each sweep).
  const refreshRunning = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return;
      const rows = await listRunningCampaigns(sb, user.id);
      setRunning(rows.map((r) => ({ id: r.id, query: r.query })));
      for (const r of rows) store.setRunStatus(r.id, 'running', r.query);
    } catch {
      /* ignore — next tick retries */
    }
  }, []);

  useEffect(() => {
    void refreshRunning();
  }, [refreshRunning]);

  // Poll only while something is running.
  useEffect(() => {
    if (running.length === 0) return;
    let alive = true;

    const tick = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        for (const c of running) {
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
        if (alive) await refreshRunning(); // drops finished ones → loop stops
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
  }, [running, refreshRunning]);

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
          {/* Opens this exact campaign in Discover — restore only, no re-search. */}
          <Button asChild size="sm" className="mt-2 h-7">
            <Link
              href={`/discover?campaign=${finished.id}`}
              onClick={() => store.clearJustFinished()}
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
