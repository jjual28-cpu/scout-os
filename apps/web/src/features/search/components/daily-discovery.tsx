'use client';

import { AlertCircle, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

import { DISCOVER_CATEGORIES, type DiscoverOpportunity } from '../discover-mock';
import { toDiscoverOpportunity, type InstagramCreator } from '../instagram';
import { DiscoverCard } from './discover-card';

/** Default seed for the daily feed when real discovery is enabled. */
const DEFAULT_HASHTAG = 'kbeauty';

type State =
  | { kind: 'loading' }
  | { kind: 'mock'; error?: string }
  | { kind: 'real'; items: DiscoverOpportunity[] };

/**
 * "Today's Opportunities" — the daily-discovery home.
 *
 * Fetches real Instagram creators from the server API (`/api/discover/instagram`).
 * If Apify isn't configured, or the fetch fails, it falls back to the existing
 * mock feed — same card design either way. The browser never calls Apify.
 */
export function DailyDiscovery() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/discover/instagram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hashtag: DEFAULT_HASHTAG, limit: 12 }),
        });
        const json = (await res.json().catch(() => null)) as {
          data?: { configured: boolean; creators: InstagramCreator[] };
          error?: { message?: string };
        } | null;

        if (!active) return;

        if (!res.ok || !json || json.error || !json.data) {
          setState({
            kind: 'mock',
            error: json?.error?.message ?? 'Instagram 데이터를 불러오지 못했습니다.',
          });
          return;
        }

        const { configured, creators } = json.data;
        if (!configured || !creators?.length) {
          setState({ kind: 'mock' });
          return;
        }
        setState({ kind: 'real', items: creators.map(toDiscoverOpportunity) });
      } catch {
        if (active) setState({ kind: 'mock', error: 'Instagram 데이터를 불러오지 못했습니다.' });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const mockTotal = DISCOVER_CATEGORIES.reduce((sum, c) => sum + c.items.length, 0);
  const total = state.kind === 'real' ? state.items.length : mockTotal;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-2">
        <div className="bg-primary/5 text-primary mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
          <Sparkles className="size-3.5" />
          Daily Discovery
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Today&apos;s Opportunities
        </h1>
        <p className="text-muted-foreground mt-2">
          오늘 Scout OS가 새로 발견한 기회 {total}건 — 매일 아침, 먼저 확인하세요.
        </p>
      </header>

      {state.kind === 'mock' && state.error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mt-6 flex items-start gap-2 rounded-md border p-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      {state.kind === 'loading' ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-2xl" />
          ))}
        </div>
      ) : state.kind === 'real' ? (
        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Instagram 크리에이터</h2>
            <span className="bg-muted text-muted-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium">
              {state.items.length}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.items.map((item) => (
              <DiscoverCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : (
        DISCOVER_CATEGORIES.map((category) => (
          <section key={category.type} className="mt-10">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{category.label}</h2>
              <span className="bg-muted text-muted-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium">
                {category.items.length}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {category.items.map((item) => (
                <DiscoverCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
