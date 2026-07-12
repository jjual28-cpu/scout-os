'use client';

import {
  ArrowRight,
  Clock,
  Instagram,
  Loader2,
  Music2,
  Search,
  SearchX,
  Sparkles,
  TrendingUp,
  Youtube,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { DISCOVER_CATEGORIES, type DiscoverOpportunity } from '../discover-mock';
import { toDiscoverOpportunity, type InstagramCreator } from '../instagram';
import { keywordEmoji } from '../keyword';
import { DiscoverCard } from './discover-card';

/** Curated popular keywords shown on the home screen. */
const POPULAR = [
  '뷰티',
  '패션',
  '운동',
  '골프',
  '반려동물',
  '캠핑',
  '여행',
  '카페',
  '육아',
  '맛집',
];
const RECENT_KEY = 'scout:recent-searches';
const MAX_RECENT = 8;

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: Instagram, enabled: true },
  { id: 'youtube', label: 'YouTube', icon: Youtube, enabled: false },
  { id: 'tiktok', label: 'TikTok', icon: Music2, enabled: false },
] as const;

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

export function CreatorSearch() {
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [keyword, setKeyword] = useState('');
  const [platform, setPlatform] = useState<string>('instagram');
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
      if (my !== reqId.current) return; // superseded by a newer search

      const data = json?.data;
      if (data?.configured && Array.isArray(data.creators)) {
        setItems(data.creators.map(toDiscoverOpportunity));
        setCount(data.creators.length);
      } else if (data && data.configured === false) {
        setItems(MOCK_ITEMS); // Apify unconfigured → mock only (never mixed)
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

  const isHome = phase === 'idle';

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Soft ambient glow on the home screen (premium, subtle) */}
      {isHome ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,hsl(var(--primary)/0.10),transparent)]"
        />
      ) : null}

      {isHome ? (
        // ── Home hero ──────────────────────────────────────────────
        <section className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 pb-20 pt-20 text-center sm:pt-28">
          <div className="bg-background/70 text-muted-foreground mb-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="text-primary size-3.5" />
            Creator Discovery
          </div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">
            브랜드에 맞는 크리에이터를
            <br className="hidden sm:block" /> 검색 한 번으로 찾으세요
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-base leading-relaxed sm:text-lg">
            키워드만 입력하면 실제 인스타그램 크리에이터를 즉시 찾아드려요. 저장하고, DM으로
            연락하고, 후속까지 한 곳에서.
          </p>

          <div className="mt-8">
            <PlatformSelector platform={platform} onSelect={setPlatform} />
          </div>

          <div className="mt-4 w-full">
            <SearchField
              value={input}
              size="lg"
              autoFocus
              onChange={setInput}
              onSubmit={() => void runSearch(input)}
            />
          </div>

          <ChipRow
            icon={<TrendingUp className="size-3.5" />}
            label="인기 검색"
            chips={POPULAR}
            onPick={(c) => void runSearch(c)}
            className="mt-7"
            center
          />
          {recent.length > 0 ? (
            <ChipRow
              icon={<Clock className="size-3.5" />}
              label="최근 검색"
              chips={recent}
              variant="soft"
              onPick={(c) => void runSearch(c)}
              className="mt-5"
              center
            />
          ) : null}
        </section>
      ) : (
        // ── Compact top search bar (after first search) ────────────
        <div className="bg-background/80 sticky top-14 z-[5] border-b backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-6 py-3.5">
            <div className="flex-1">
              <SearchField
                value={input}
                size="md"
                onChange={setInput}
                onSubmit={() => void runSearch(input)}
              />
            </div>
            <div className="hidden sm:block">
              <PlatformSelector platform={platform} onSelect={setPlatform} compact />
            </div>
          </div>
        </div>
      )}

      {/* ── Searching ─────────────────────────────────────────────── */}
      {phase === 'searching' ? (
        <section className="mx-auto w-full max-w-6xl px-6 py-10">
          <div className="text-muted-foreground mb-8 flex items-center justify-center gap-2 text-sm">
            <Loader2 className="text-primary size-4 animate-spin" />
            <span>
              <span className="text-foreground font-medium">‘{keyword}’</span> 크리에이터를 찾는 중…
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3 rounded" />
                    <Skeleton className="h-3 w-1/3 rounded" />
                  </div>
                </div>
                <Skeleton className="mt-4 h-3 w-full rounded" />
                <Skeleton className="mt-2 h-3 w-4/5 rounded" />
                <Skeleton className="mt-5 h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Results ───────────────────────────────────────────────── */}
      {phase === 'done' ? (
        <section className="mx-auto w-full max-w-6xl px-6 py-10">
          {error ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mb-6 rounded-xl border p-3 text-sm">
              {error}
            </div>
          ) : null}

          {items.length > 0 ? (
            <>
              {/* Results header — minimal, Linear-like */}
              <div className="mb-8 flex flex-wrap items-end justify-between gap-3 border-b pb-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl leading-none">{keywordEmoji(keyword)}</span>
                    <h2 className="truncate text-2xl font-semibold tracking-tight">{keyword}</h2>
                  </div>
                  <p className="text-muted-foreground mt-1.5 text-sm">
                    Instagram · 크리에이터{' '}
                    <span className="text-foreground font-medium">{count}명</span> 발견
                  </p>
                </div>
                <p className="text-muted-foreground text-xs">
                  마지막 검색 · {relativeTime(searchedAt)}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <DiscoverCard key={item.id} item={item} keyword={keyword} />
                ))}
              </div>
            </>
          ) : (
            <div className="mx-auto max-w-md py-20 text-center">
              <div className="bg-muted/60 text-muted-foreground mx-auto flex size-16 items-center justify-center rounded-2xl">
                <SearchX className="size-8" />
              </div>
              <h2 className="mt-5 text-lg font-semibold">‘{keyword}’ 결과가 없어요</h2>
              <p className="text-muted-foreground mt-1.5 text-sm">
                다른 키워드로 다시 검색해보세요.
              </p>
              <ChipRow
                chips={POPULAR.slice(0, 6)}
                onPick={(c) => void runSearch(c)}
                className="mt-6"
                center
              />
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presentational sub-components (same file — search-only)
// ---------------------------------------------------------------------------
function SearchField({
  value,
  onChange,
  onSubmit,
  size = 'lg',
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  size?: 'lg' | 'md';
  autoFocus?: boolean;
}) {
  const big = size === 'lg';
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="w-full"
    >
      <div className="relative flex items-center">
        <Search
          className={cn(
            'text-muted-foreground pointer-events-none absolute left-4 -translate-y-0',
            big ? 'size-5' : 'left-3.5 size-4',
          )}
        />
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional on the search home
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="예: 뷰티, 골프, 반려동물…"
          className={cn(
            'border-input bg-background/80 focus-visible:ring-ring/60 w-full rounded-2xl border shadow-sm outline-none transition-shadow focus-visible:shadow-md focus-visible:ring-2',
            big ? 'h-16 pl-12 pr-16 text-base' : 'h-11 pl-10 pr-12 text-sm',
          )}
        />
        <button
          type="submit"
          aria-label="검색"
          className={cn(
            'bg-primary text-primary-foreground hover:bg-primary/90 absolute right-2 inline-flex items-center justify-center rounded-xl transition-colors',
            big ? 'size-11' : 'right-1.5 size-8 rounded-lg',
          )}
        >
          <ArrowRight className={big ? 'size-5' : 'size-4'} />
        </button>
      </div>
    </form>
  );
}

function PlatformSelector({
  platform,
  onSelect,
  compact,
}: {
  platform: string;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="bg-card inline-flex items-center gap-0.5 rounded-full border p-1">
      {PLATFORMS.map((p) => {
        const active = platform === p.id;
        const Icon = p.icon;
        return (
          <button
            key={p.id}
            type="button"
            disabled={!p.enabled}
            aria-pressed={active}
            onClick={() => p.enabled && onSelect(p.id)}
            title={p.enabled ? p.label : `${p.label} · 준비 중`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full font-medium transition-colors',
              compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              !p.enabled && 'hover:text-muted-foreground cursor-not-allowed opacity-45',
            )}
          >
            <Icon className={compact ? 'size-3.5' : 'size-4'} />
            {p.label}
            {!p.enabled ? <span className="text-[10px] font-normal">곧</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function ChipRow({
  chips,
  onPick,
  label,
  icon,
  variant = 'outline',
  center,
  className,
}: {
  chips: string[];
  onPick: (chip: string) => void;
  label?: string;
  icon?: React.ReactNode;
  variant?: 'outline' | 'soft';
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('w-full', center ? 'text-center' : 'text-left', className)}>
      {label ? (
        <p
          className={cn(
            'text-muted-foreground flex items-center gap-1.5 text-xs font-medium',
            center && 'justify-center',
          )}
        >
          {icon}
          {label}
        </p>
      ) : null}
      <div className={cn('mt-2.5 flex flex-wrap gap-1.5', center && 'justify-center')}>
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            className={cn(
              'rounded-full px-3 py-1 text-sm transition-colors',
              variant === 'outline'
                ? 'text-muted-foreground hover:border-primary/40 hover:text-foreground border'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
            )}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
