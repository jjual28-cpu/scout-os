'use client';

import {
  ArrowUpDown,
  Bookmark,
  Check,
  ChevronDown,
  Clock,
  Instagram,
  Loader2,
  MessageSquarePlus,
  Music2,
  Package,
  Search,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  X,
  Youtube,
  ArrowRight,
  History,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { EmptyState } from '@/components/layout/blocks';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useCampaigns } from '@/features/campaigns/hooks/use-campaigns';
import { consumeCampaignDraft } from '@/features/campaigns/draft';
import { type CampaignDraft } from '@/features/campaigns/types';
import { useProducts } from '@/features/products/hooks/use-products';

import { isDefaultHidden } from '../creator-status';
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

const RAIL_FIELD =
  'border-input bg-background focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2';

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
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [hideHandled, setHideHandled] = useState(true);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const saved = useSavedOpportunities();
  const outreach = useOutreach();
  const products = useProducts();
  const { campaigns } = useCampaigns();

  // Metadata carried in from a Campaign (다시 검색 / 복제); applied to the next
  // search then cleared so later manual searches aren't tagged with stale meta.
  const draftMeta = useRef<CampaignDraft | null>(null);

  useEffect(() => {
    setRecent(readRecent());
    const draft = consumeCampaignDraft();
    if (draft) {
      draftMeta.current = draft;
      setInput(draft.query);
      setKeyword(draft.query);
      if (draft.productId) setSelectedProductId(draft.productId);
      if (draft.autoRun) void runSearch(draft.query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setCampaignId(null);
    setSaveFailed(false);
    setRecent(pushRecent(q));

    const meta = draftMeta.current;
    draftMeta.current = null; // one-shot
    const body: Record<string, unknown> = { query: q, limit: 24 };
    if (meta) {
      if (meta.title) body.title = meta.title;
      if (meta.brand) body.brand = meta.brand;
      if (meta.season) body.season = meta.season;
      if (meta.goal) body.goal = meta.goal;
      if (meta.memo) body.memo = meta.memo;
      if (meta.label) body.label = meta.label;
      if (meta.productId) body.productId = meta.productId;
    }
    // Product picked in the Search Rail (uses the route's existing productId param).
    if (!body.productId && selectedProductId) body.productId = selectedProductId;

    const my = ++reqId.current;
    try {
      const res = await fetch('/api/discover/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: {
          configured: boolean;
          creators: InstagramCreator[];
          campaignId?: string | null;
          resultsSaved?: boolean;
        };
      } | null;
      if (my !== reqId.current) return; // superseded by a newer search

      const data = json?.data;
      if (data?.configured && Array.isArray(data.creators)) {
        setItems(data.creators.map(toDiscoverOpportunity));
        setCampaignId(data.campaignId ?? null);
        setSaveFailed(data.campaignId != null && data.resultsSaved === false);
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

  // Creators hidden ONLY because they're already handled (연락완료/답변/협업/제외).
  // The DB keeps the full result set — this filter is screen-only.
  const hiddenHandledCount = useMemo(
    () => items.filter((it) => isDefaultHidden(outreach.records[it.id]?.status)).length,
    [items, outreach.records],
  );

  // Filter + sort (client-side, over the current result set)
  const visible = useMemo(() => {
    const filtered = items.filter((it) => {
      if (hideHandled && isDefaultHidden(outreach.records[it.id]?.status)) return false;
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
  }, [items, buckets, toggles, sort, hideHandled, outreach.records]);

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

  const recentCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4),
    [campaigns],
  );

  // ── Search Rail body (product / keywords / filters / recent campaigns) ──────
  const railBody = (
    <div className="space-y-6">
      {products.products.length > 0 ? (
        <div>
          <RailLabel icon={<Package className="size-3.5" />}>상품 선택</RailLabel>
          <select
            value={selectedProductId ?? ''}
            onChange={(e) => setSelectedProductId(e.target.value || null)}
            className={RAIL_FIELD}
          >
            <option value="">상품 없이 검색</option>
            {products.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <ChipRow
        icon={<TrendingUp className="size-3.5" />}
        label="추천 키워드"
        chips={POPULAR}
        onPick={(c) => void runSearch(c)}
      />

      {recent.length > 0 ? (
        <ChipRow
          icon={<Clock className="size-3.5" />}
          label="최근 검색"
          chips={recent}
          variant="soft"
          onPick={(c) => void runSearch(c)}
        />
      ) : null}

      <div>
        <RailLabel icon={<SlidersHorizontal className="size-3.5" />}>필터</RailLabel>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {BUCKETS.map((b) => (
              <FilterChip key={b.id} active={buckets.has(b.id)} onClick={() => toggleBucket(b.id)}>
                {b.label}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TOGGLES.map((t) => (
              <FilterChip key={t.id} active={toggles.has(t.id)} onClick={() => toggleToggle(t.id)}>
                {t.label}
              </FilterChip>
            ))}
          </div>
        </div>
      </div>

      {recentCampaigns.length > 0 ? (
        <div>
          <RailLabel icon={<History className="size-3.5" />}>최근 캠페인</RailLabel>
          <div className="space-y-0.5">
            {recentCampaigns.map((c) => (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="hover:text-foreground dark:text-muted-foreground dark:hover:bg-muted block truncate rounded-md px-2 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100"
              >
                {c.title}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  // ── Results Workspace ───────────────────────────────────────────────────────
  const skeletons = (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="dark:border-border rounded-2xl border border-slate-200/60 p-5">
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
  );

  const resultsWorkspace =
    phase === 'idle' ? (
      <EmptyState
        className="min-h-[340px] justify-center"
        icon={<Search className="size-5" />}
        title="셀럽을 검색해보세요"
        description="키워드를 입력하거나 추천 키워드를 눌러 검색을 시작하세요."
      />
    ) : phase === 'searching' ? (
      <div>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="text-primary size-4 animate-spin" />
          <span>
            <span className="text-foreground font-medium">‘{keyword}’</span> 셀럽을 찾는 중…
          </span>
        </div>
        <div className="bg-muted mt-4 h-1.5 w-full overflow-hidden rounded-full">
          <div className="bg-primary h-full w-2/5 animate-pulse rounded-full" />
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          인스타그램 검색 → 프로필 수집 → 추천 이유 분석 · 예상 20~30초
        </p>
        {skeletons}
      </div>
    ) : (
      <>
        {error ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive mb-6 rounded-xl border p-3 text-sm">
            {error}
          </div>
        ) : null}

        {items.length > 0 ? (
          <>
            {/* Results header */}
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{keywordEmoji(keyword)}</span>
                  <h2 className="truncate text-xl font-semibold tracking-tight">{keyword}</h2>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  Instagram · 셀럽{' '}
                  <span className="text-foreground font-medium">{visible.length}명</span>
                  {visible.length !== items.length ? ` / ${items.length}명` : ''} ·{' '}
                  {relativeTime(searchedAt)}
                </p>
              </div>
            </div>

            {/* Save state */}
            {saveFailed ? (
              <div className="border-destructive/30 bg-destructive/10 text-destructive mb-5 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm">
                <AlertTriangle className="size-4 shrink-0" />
                검색 결과 저장에 실패했어요. 결과가 캠페인에 저장되지 않았습니다 · 잠시 후 다시
                시도해 주세요.
              </div>
            ) : campaignId ? (
              <div className="border-primary/20 bg-primary/[0.04] text-muted-foreground mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <History className="text-primary size-4" />
                  캠페인이 만들어졌습니다 · 진행 현황을 캠페인에서 관리하세요.
                </span>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/campaigns/${campaignId}`}>
                    캠페인 보기
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            ) : null}

            {/* AI Summary */}
            {summary.length > 0 ? (
              <div className="border-primary/20 bg-primary/[0.04] mb-5 rounded-2xl border p-5">
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

            {/* Sort + hidden toggle */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {hiddenHandledCount > 0 ? (
                <FilterChip active={!hideHandled} onClick={() => setHideHandled((v) => !v)}>
                  <EyeOff className="size-3.5" />
                  이미 연락한 {hiddenHandledCount}명 {hideHandled ? '숨김' : '표시 중'}
                </FilterChip>
              ) : null}
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
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
              <EmptyState
                className="min-h-[240px] justify-center"
                icon={<SearchX className="size-5" />}
                title="필터 조건에 맞는 셀럽이 없어요"
                description="필터를 조정해 보세요."
              />
            )}
          </>
        ) : (
          <EmptyState
            className="min-h-[340px] justify-center"
            icon={<SearchX className="size-5" />}
            title={`‘${keyword}’ 결과가 없어요`}
            description="다른 키워드로 다시 검색해보세요."
          />
        )}
      </>
    );

  return (
    <div className="relative">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
        <PageHeader
          title="Discover"
          description="브랜드에 맞는 셀럽을 검색하고, 결과를 캠페인으로 저장하세요."
        />

        <div className="gap-8 lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* ── Search Rail ── */}
          <aside className="lg:sticky lg:top-[76px] lg:self-start">
            <div className="space-y-3">
              <SearchField
                value={input}
                size="md"
                onChange={setInput}
                onSubmit={() => void runSearch(input)}
              />
              <PlatformSelector platform={platform} onSelect={setPlatform} compact />
            </div>

            {/* Mobile: collapsible options; Desktop: always visible */}
            <details className="dark:border-border group mt-4 rounded-xl border border-slate-200/60 lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium">
                상품 · 키워드 · 필터
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="dark:border-border border-t border-slate-200/60 p-4">{railBody}</div>
            </details>
            <div className="mt-6 hidden lg:block">{railBody}</div>
          </aside>

          {/* ── Results Workspace ── */}
          <div className="mt-6 lg:mt-0">{resultsWorkspace}</div>
        </div>
      </div>

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
function RailLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="dark:text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
      {icon}
      {children}
    </p>
  );
}

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
          : 'hover:text-foreground dark:border-border dark:text-muted-foreground border-slate-200/70 text-slate-600',
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
            'dark:text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500',
            center && 'justify-center',
          )}
        >
          {icon}
          {label}
        </p>
      ) : null}
      <div className={cn('flex flex-wrap gap-1.5', center && 'justify-center')}>
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            className={cn(
              'rounded-full px-3 py-1 text-sm transition-colors',
              variant === 'outline'
                ? 'hover:border-primary/40 hover:text-foreground dark:border-border dark:text-muted-foreground border border-slate-200/70 text-slate-600'
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
