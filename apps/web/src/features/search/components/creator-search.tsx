'use client';

import {
  ArrowUpDown,
  Bookmark,
  Check,
  Clock,
  Instagram,
  Loader2,
  MessageSquarePlus,
  Music2,
  Search,
  SearchX,
  Sparkles,
  TrendingUp,
  X,
  Youtube,
  ArrowRight,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { DISCOVER_CATEGORIES, type DiscoverOpportunity } from '../discover-mock';
import { useOutreach } from '../hooks/use-outreach';
import { useSavedOpportunities } from '../hooks/use-saved-opportunities';
import { toDiscoverOpportunity, type InstagramCreator } from '../instagram';
import { keywordEmoji } from '../keyword';
import { summarizeResults } from '../recommend';
import { DiscoverCard } from './discover-card';

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

// ── Filters / sort ──────────────────────────────────────────────────────────
type Bucket = '0-5k' | '5k-10k' | '10k-50k' | '50k+';
const BUCKETS: { id: Bucket; label: string }[] = [
  { id: '0-5k', label: '0~5K' },
  { id: '5k-10k', label: '5K~10K' },
  { id: '10k-50k', label: '10K~50K' },
  { id: '50k+', label: '50K+' },
];
type Toggle = 'verified' | 'business' | 'bio' | 'email';
const TOGGLES: { id: Toggle; label: string }[] = [
  { id: 'verified', label: '인증' },
  { id: 'business', label: '비즈니스' },
  { id: 'bio', label: 'Bio 있음' },
  { id: 'email', label: 'Email 있음' },
];
type SortKey = 'recommended' | 'followers' | 'recent' | 'posts';
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'recommended', label: '추천순' },
  { id: 'followers', label: '팔로워순' },
  { id: 'recent', label: '최근 발견순' },
  { id: 'posts', label: '게시물순' },
];

function inBucket(f: number, b: Bucket): boolean {
  if (b === '0-5k') return f < 5_000;
  if (b === '5k-10k') return f >= 5_000 && f < 10_000;
  if (b === '10k-50k') return f >= 10_000 && f < 50_000;
  return f >= 50_000;
}

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
  const [searchedAt, setSearchedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const reqId = useRef(0);

  // Workspace controls
  const [buckets, setBuckets] = useState<Set<Bucket>>(new Set());
  const [toggles, setToggles] = useState<Set<Toggle>>(new Set());
  const [sort, setSort] = useState<SortKey>('recommended');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const saved = useSavedOpportunities();
  const outreach = useOutreach();

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  async function runSearch(raw: string) {
    const q = raw.trim();
    if (!q) return;
    if (phase === 'searching') return; // prevent duplicate Apify calls while one is in flight
    setInput(q);
    setKeyword(q);
    setError(null);
    setPhase('searching');
    setSelected(new Set());
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
      } else if (data && data.configured === false) {
        setItems(MOCK_ITEMS); // Apify unconfigured → mock only (never mixed)
      } else {
        setItems([]);
      }
      setSearchedAt(Date.now());
      setPhase('done');
    } catch {
      if (my !== reqId.current) return;
      setError('검색 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.');
      setItems([]);
      setSearchedAt(Date.now());
      setPhase('done');
    }
  }

  // Filter + sort (client-side, over the current result set)
  const visible = useMemo(() => {
    const filtered = items.filter((it) => {
      const f = it.followersCount ?? 0;
      if (buckets.size && ![...buckets].some((b) => inBucket(f, b))) return false;
      if (toggles.has('verified') && !it.isVerified) return false;
      if (toggles.has('business') && !it.category) return false;
      if (toggles.has('bio') && !it.biography?.trim()) return false;
      if (toggles.has('email') && !it.reasons?.includes('연락처 공개')) return false;
      return true;
    });
    const arr = [...filtered];
    if (sort === 'followers') arr.sort((a, b) => (b.followersCount ?? 0) - (a.followersCount ?? 0));
    else if (sort === 'posts') arr.sort((a, b) => (b.postsCount ?? 0) - (a.postsCount ?? 0));
    else if (sort === 'recommended')
      arr.sort(
        (a, b) =>
          (b.reasons?.length ?? 0) - (a.reasons?.length ?? 0) ||
          (b.followersCount ?? 0) - (a.followersCount ?? 0),
      );
    // 'recent' keeps the original discovery order
    return arr;
  }, [items, buckets, toggles, sort]);

  const summary = useMemo(() => summarizeResults(items), [items]);

  const toggleBucket = (b: Bucket) =>
    setBuckets((prev) => {
      const next = new Set(prev);
      next.has(b) ? next.delete(b) : next.add(b);
      return next;
    });
  const toggleToggle = (t: Toggle) =>
    setToggles((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  const onSelectChange = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });

  const selectedItems = useMemo(
    () => visible.filter((it) => selected.has(it.id)),
    [visible, selected],
  );

  const bulkSave = () => {
    selectedItems.forEach((it) => {
      if (!saved.isSaved(it.id)) saved.save(it);
    });
  };
  const bulkPrepare = () => {
    selectedItems.forEach((it) => {
      if (!saved.isSaved(it.id)) saved.save(it);
      outreach.setStatus(it.id, '연락예정');
    });
    setSelected(new Set());
  };

  const isHome = phase === 'idle';

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {isHome ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,hsl(var(--primary)/0.10),transparent)]"
        />
      ) : null}

      {isHome ? (
        <section className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 pb-20 pt-20 text-center sm:pt-28">
          <div className="bg-background/70 text-muted-foreground mb-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="text-primary size-3.5" />
            Creator Partnership CRM
          </div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">
            브랜드에 맞는 크리에이터를
            <br className="hidden sm:block" /> 찾고, 연락하고, 관리하세요
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-base leading-relaxed sm:text-lg">
            키워드 검색부터 저장·AI 추천·DM·답변·협업 관리까지 한 곳에서. 실제 인스타그램
            크리에이터를 즉시 찾아드려요.
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

      {/* ── Searching (progress UI) ───────────────────────────────── */}
      {phase === 'searching' ? (
        <section className="mx-auto w-full max-w-6xl px-6 py-10">
          <div className="mx-auto max-w-md text-center">
            <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
              <Loader2 className="text-primary size-4 animate-spin" />
              <span>
                <span className="text-foreground font-medium">‘{keyword}’</span> 크리에이터를 찾는
                중…
              </span>
            </div>
            <div className="bg-muted mt-4 h-1.5 w-full overflow-hidden rounded-full">
              <div className="bg-primary h-full w-2/5 animate-pulse rounded-full" />
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              인스타그램 검색 → 프로필 수집 → 추천 이유 분석 · 예상 20~30초
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              {/* Header */}
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b pb-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl leading-none">{keywordEmoji(keyword)}</span>
                    <h2 className="truncate text-2xl font-semibold tracking-tight">{keyword}</h2>
                  </div>
                  <p className="text-muted-foreground mt-1.5 text-sm">
                    Instagram · 크리에이터{' '}
                    <span className="text-foreground font-medium">{visible.length}명</span>
                    {visible.length !== items.length ? ` / ${items.length}명` : ''}
                  </p>
                </div>
                <p className="text-muted-foreground text-xs">
                  마지막 검색 · {relativeTime(searchedAt)}
                </p>
              </div>

              {/* AI Summary */}
              {summary.length > 0 ? (
                <div className="border-primary/20 bg-primary/[0.04] mb-6 rounded-2xl border p-5">
                  <p className="text-primary flex items-center gap-1.5 text-sm font-semibold">
                    <Sparkles className="size-4" />
                    AI Summary
                  </p>
                  <ul className="text-foreground/90 mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                    {summary.map((line) => (
                      <li key={line} className="flex items-start gap-2">
                        <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Filters + sort */}
              <div className="mb-6 flex flex-wrap items-center gap-2">
                {BUCKETS.map((b) => (
                  <FilterChip
                    key={b.id}
                    active={buckets.has(b.id)}
                    onClick={() => toggleBucket(b.id)}
                  >
                    {b.label}
                  </FilterChip>
                ))}
                <span className="bg-border mx-1 h-5 w-px" />
                {TOGGLES.map((t) => (
                  <FilterChip
                    key={t.id}
                    active={toggles.has(t.id)}
                    onClick={() => toggleToggle(t.id)}
                  >
                    {t.label}
                  </FilterChip>
                ))}
                <div className="ml-auto flex items-center gap-1.5">
                  <ArrowUpDown className="text-muted-foreground size-3.5" />
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="border-input bg-background focus-visible:ring-ring rounded-lg border px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2"
                  >
                    {SORTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {visible.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((item) => (
                    <DiscoverCard
                      key={item.id}
                      item={item}
                      keyword={keyword}
                      selectable
                      selected={selected.has(item.id)}
                      onSelectChange={onSelectChange}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground py-16 text-center text-sm">
                  필터 조건에 맞는 크리에이터가 없어요. 필터를 조정해 보세요.
                </div>
              )}
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

      {/* ── Bulk toolbar ──────────────────────────────────────────── */}
      {selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-6 z-20 flex justify-center px-6">
          <div className="bg-card flex items-center gap-2 rounded-2xl border p-2 pl-4 shadow-xl">
            <span className="text-sm font-medium">{selected.size}명 선택</span>
            <span className="bg-border mx-1 h-5 w-px" />
            <Button type="button" size="sm" variant="outline" onClick={bulkSave}>
              <Bookmark className="size-4" />
              저장
            </Button>
            <Button type="button" size="sm" variant="default" onClick={bulkPrepare}>
              <MessageSquarePlus className="size-4" />
              연락 준비 이동
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X className="size-4" />
              선택 해제
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors',
        active
          ? 'border-primary/40 bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {active ? <Check className="size-3" /> : null}
      {children}
    </button>
  );
}

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
            'text-muted-foreground pointer-events-none absolute -translate-y-0',
            big ? 'left-4 size-5' : 'left-3.5 size-4',
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
