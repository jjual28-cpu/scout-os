'use client';

import { Clock, Loader2, Search, SearchX, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { DISCOVER_CATEGORIES, type DiscoverOpportunity } from '../discover-mock';
import { toDiscoverOpportunity, type InstagramCreator } from '../instagram';
import { DiscoverCard } from './discover-card';

const EXAMPLES = [
  '뷰티',
  '건강',
  '캠핑',
  '반려동물',
  '육아',
  '골프',
  '피트니스',
  '카페',
  '커피',
  '맛집',
];
const RECENT_KEY = 'scout:recent-searches';
const MAX_RECENT = 8;

type Phase = 'idle' | 'searching' | 'done';

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
function pushRecent(query: string): string[] {
  const next = [query, ...readRecent().filter((q) => q !== query)].slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

function relativeTime(ts: number | null): string {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return '방금 전';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

/** Mock fallback used ONLY when Apify isn't configured (never mixed with real data). */
const MOCK_ITEMS: DiscoverOpportunity[] = DISCOVER_CATEGORIES.flatMap((c) => c.items);

/**
 * Creator Discovery — the search-centric home. Before searching, only the search
 * hero shows; after a search, real Instagram creators (via Apify) render as cards.
 */
export function CreatorSearch() {
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState<DiscoverOpportunity[]>([]);
  const [count, setCount] = useState(0);
  const [searchedAt, setSearchedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const reqId = useRef(0);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  async function runSearch(raw: string) {
    const q = raw.trim();
    if (!q) return;
    setInput(q);
    setKeyword(q);
    setError(null);
    setPhase('searching');
    setRecent(pushRecent(q));

    const my = ++reqId.current;
    try {
      const res = await fetch('/api/discover/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, limit: 24 }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { configured: boolean; creators: InstagramCreator[] };
      } | null;
      if (my !== reqId.current) return; // a newer search superseded this one

      const data = json?.data;
      if (data?.configured && Array.isArray(data.creators)) {
        setItems(data.creators.map(toDiscoverOpportunity));
        setCount(data.creators.length);
      } else if (data && data.configured === false) {
        // Apify not configured → mock fallback (never mixed with real data).
        setItems(MOCK_ITEMS);
        setCount(MOCK_ITEMS.length);
      } else {
        setItems([]);
        setCount(0);
      }
      setSearchedAt(Date.now());
      setPhase('done');
    } catch {
      if (my !== reqId.current) return;
      setError('검색 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.');
      setItems([]);
      setCount(0);
      setSearchedAt(Date.now());
      setPhase('done');
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      {/* ── Search hero ─────────────────────────────────────────── */}
      <header className={cn('mx-auto max-w-2xl text-center', phase === 'idle' && 'pt-10')}>
        <div className="bg-primary/5 text-primary mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
          <Sparkles className="size-3.5" />
          Creator Discovery
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          원하는 주제나 키워드를 검색하세요
        </h1>
        <p className="text-muted-foreground mt-3">
          업종에 맞는 인스타그램 크리에이터를 검색 한 번으로 찾아보세요.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(input);
          }}
          className="mt-7"
        >
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2" />
              <input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="예: 뷰티, 골프, 반려동물…"
                className="border-input bg-background focus-visible:ring-ring h-14 w-full rounded-2xl border pl-12 pr-4 text-base outline-none focus-visible:ring-2"
              />
            </div>
            <Button type="submit" size="lg" className="h-14 shrink-0 rounded-2xl px-6">
              검색
            </Button>
          </div>
        </form>

        {/* 예시 키워드 */}
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => void runSearch(ex)}
              className="text-muted-foreground hover:border-primary/40 hover:text-foreground rounded-full border px-3 py-1 text-sm transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>

        {/* 최근 검색 */}
        {recent.length > 0 ? (
          <div className="mt-6 text-left">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
              <Clock className="size-3.5" />
              최근 검색
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recent.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => void runSearch(r)}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/70 rounded-full px-3 py-1 text-sm transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      {/* ── Searching skeleton ──────────────────────────────────── */}
      {phase === 'searching' ? (
        <section className="mt-12">
          <div className="text-muted-foreground mb-6 flex items-center justify-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            <span className="animate-pulse">Searching Instagram creators…</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-2xl" />
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Results ─────────────────────────────────────────────── */}
      {phase === 'done' ? (
        <section className="mt-12">
          {error ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mb-6 rounded-lg border p-3 text-sm">
              {error}
            </div>
          ) : null}

          {/* 결과 요약 바 */}
          <div className="bg-card mb-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-2xl border p-5">
            <div>
              <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                검색어
              </p>
              <p className="mt-0.5 text-lg font-semibold">{keyword}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                검색 결과
              </p>
              <p className="mt-0.5 text-lg font-semibold">{count}명의 크리에이터 발견</p>
            </div>
            <div>
              <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                마지막 검색
              </p>
              <p className="mt-0.5 text-lg font-semibold">{relativeTime(searchedAt)}</p>
            </div>
          </div>

          {items.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <DiscoverCard key={item.id} item={item} keyword={keyword} />
              ))}
            </div>
          ) : (
            <div className="mx-auto max-w-md py-16 text-center">
              <div className="bg-muted text-muted-foreground mx-auto flex size-14 items-center justify-center rounded-2xl">
                <SearchX className="size-7" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">검색 결과가 없습니다</h2>
              <p className="text-muted-foreground mt-1 text-sm">다른 키워드로 다시 검색해보세요.</p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
