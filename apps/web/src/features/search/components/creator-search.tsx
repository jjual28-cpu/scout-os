'use client';

import {
  ArrowUpDown,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Instagram,
  Loader2,
  MessageSquarePlus,
  Music2,
  Package,
  RefreshCw,
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
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { EmptyState } from '@/components/layout/blocks';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import * as runStore from '@/features/campaigns/campaign-run-store';
import { useCampaigns } from '@/features/campaigns/hooks/use-campaigns';
import { consumeCampaignDraft } from '@/features/campaigns/draft';
import { getLastViewedCampaign, setLastViewedCampaign } from '@/features/campaigns/last-viewed';
import { getLatestCampaign, listResults } from '@/features/campaigns/services/campaign-service';
import { type CampaignDraft, type CampaignResult } from '@/features/campaigns/types';
import { useProducts } from '@/features/products/hooks/use-products';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

import { isDefaultHidden } from '../creator-status';
import { DISCOVER_CATEGORIES, type DiscoverOpportunity } from '../discover-mock';
import { useOutreach } from '../hooks/use-outreach';
import { useSavedOpportunities } from '../hooks/use-saved-opportunities';
import { toDiscoverOpportunity, type InstagramCreator } from '../instagram';
import { keywordEmoji } from '../keyword';
import { summarizeResults } from '../recommend';
import { DiscoverCard } from './discover-card';

/** A stored campaign_results snapshot → the same card shape the live search uses. */
function snapshotToOpportunity(s: CampaignResult): DiscoverOpportunity {
  const creator: InstagramCreator = {
    id: s.externalId,
    platform: 'instagram',
    username: s.username,
    displayName: s.displayName,
    profileUrl: s.profileUrl,
    profileImageUrl: s.profileImageUrl,
    biography: s.biography,
    followersCount: s.followersCount,
    followingCount: s.followingCount,
    postsCount: s.postsCount,
    isVerified: s.isVerified,
    category: s.category,
    rawData: null,
  };
  return toDiscoverOpportunity(creator);
}

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

/** HH:MM of an ISO timestamp. */
function clock(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

/** Search duration (started → completed), auto-calculated. */
function durationLabel(startedAt: string | null, completedAt: string | null): string | null {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${s % 60}초`;
}

const STAGES = [
  { n: 1, label: '프로필 수집' },
  { n: 2, label: '게시물 분석' },
  { n: 3, label: '상세 분석' },
] as const;

/** Stage 1 → 2 → 3 tracker: done = check, current = emphasized, pending = muted. */
function StageTracker({ stage, progress }: { stage: number; progress: number }) {
  return (
    <div className="mt-5">
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(5, Math.min(progress, 100))}%` }}
        />
      </div>
      <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {STAGES.map((s) => {
          const done = stage > s.n;
          const current = stage === s.n;
          return (
            <li
              key={s.n}
              className={cn(
                'flex items-center gap-1.5 text-xs',
                current
                  ? 'text-foreground font-medium'
                  : done
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/50',
              )}
            >
              {done ? (
                <Check className="size-3.5 text-emerald-600" />
              ) : current ? (
                <Loader2 className="text-primary size-3.5 animate-spin" />
              ) : (
                <span className="bg-muted-foreground/30 size-1.5 rounded-full" />
              )}
              Stage {s.n} · {s.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
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
  const reqId = useRef(0);

  // Workspace controls
  const [buckets, setBuckets] = useState<Set<Bucket>>(new Set());
  const [toggles, setToggles] = useState<Set<Toggle>>(new Set());
  const [sort, setSort] = useState<SortKey>('recommended');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [times, setTimes] = useState<{ startedAt: string | null; completedAt: string | null }>({
    startedAt: null,
    completedAt: null,
  });
  const [hideHandled, setHideHandled] = useState(true);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const saved = useSavedOpportunities();
  const outreach = useOutreach();
  const products = useProducts();
  const { campaigns } = useCampaigns();

  // Global poller's view of in-flight searches → auto-refresh when ours finishes.
  const runSnap = useSyncExternalStore(
    runStore.subscribe,
    runStore.getSnapshot,
    runStore.getServerSnapshot,
  );

  // Metadata carried in from a Campaign (다시 검색 / 복제); applied to the next
  // search then cleared so later manual searches aren't tagged with stale meta.
  const draftMeta = useRef<CampaignDraft | null>(null);

  /** Load a campaign + its stored results — the single source of truth for the view.
   *  Returns false when the campaign can't be opened (e.g. deleted), so callers
   *  can fall back to the next restore candidate. */
  const openCampaign = useCallback(async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) return false;
    try {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return false;
      const { data: row } = await sb
        .from('campaigns')
        .select('id,query,status,error,created_at,completed_at,started_at')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!row) return false;
      const c = row as unknown as {
        id: string;
        query: string;
        status: 'running' | 'succeeded' | 'failed';
        error: string | null;
        created_at: string;
        completed_at: string | null;
        started_at: string | null;
      };

      setCampaignId(c.id);
      setLastViewedCampaign(c.id); // Discover reopens this session next time
      setKeyword(c.query);
      setInput(c.query); // the search box always carries the campaign's query
      setSearchedAt(new Date(c.completed_at ?? c.created_at).getTime());
      setTimes({ startedAt: c.started_at, completedAt: c.completed_at });

      if (c.status === 'running') {
        setPhase('searching');
        setError(null);
        return true;
      }
      if (c.status === 'failed') {
        setPhase('done');
        setItems([]);
        setError(c.error ?? '검색이 실패했습니다. 다시 검색해 주세요.');
        return true;
      }
      const results = await listResults(sb, user.id, c.id);
      setItems(results.map(snapshotToOpportunity));
      setError(null);
      setPhase('done');
      return true;
    } catch {
      return false; // leave the current view untouched
    }
  }, []);

  // ── Restore on entry: Discover is a Campaign Viewer, never a blank screen ──
  useEffect(() => {
    const draft = consumeCampaignDraft();
    if (draft) {
      draftMeta.current = draft;
      setInput(draft.query);
      setKeyword(draft.query);
      if (draft.productId) setSelectedProductId(draft.productId);
      setRestoring(false);
      if (draft.autoRun) void runSearch(draft.query, true);
      return;
    }
    (async () => {
      if (!isSupabaseConfigured()) {
        setRestoring(false);
        return;
      }
      try {
        const sb = createClient();
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) {
          setRestoring(false);
          return;
        }
        // Restore priority: ?campaign=<id> (Campaign 상세 → 결과 보기)
        //   → the session the user last had open → newest running/succeeded/failed.
        // Reading location directly avoids forcing a Suspense boundary here.
        const fromUrl = new URLSearchParams(window.location.search).get('campaign');
        const target = fromUrl ?? getLastViewedCampaign();
        // never re-runs Apify — results come straight from the DB
        if (target && (await openCampaign(target))) return;
        const latest = await getLatestCampaign(sb, user.id);
        if (latest) await openCampaign(latest.id);
      } catch {
        /* fall through to the empty start screen */
      } finally {
        setRestoring(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The global poller finished our campaign → pull the saved results in.
  const myStatus = campaignId ? runSnap.statuses[campaignId] : undefined;
  useEffect(() => {
    if (!campaignId) return;
    if (myStatus === 'succeeded' || myStatus === 'failed') void openCampaign(campaignId);
  }, [campaignId, myStatus, openCampaign]);

  // Completion toast tapped "바로 보기" → open that campaign even if Discover is
  // already on screen (a same-page URL change wouldn't remount this component).
  const openRequest = runSnap.openRequest;
  useEffect(() => {
    if (!openRequest) return;
    void openCampaign(openRequest);
    runStore.clearOpenRequest();
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [openRequest, openCampaign]);

  // Progressive results: while a search runs, pull in whatever's already been
  // found (Stage 1 saves first) so the user sees the first batch immediately and
  // can browse while the rest keeps coming — instead of staring at a spinner.
  useEffect(() => {
    if (!campaignId || phase !== 'searching' || !isSupabaseConfigured()) return;
    let alive = true;
    const load = async () => {
      try {
        const sb = createClient();
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user || !alive) return;
        const results = await listResults(sb, user.id, campaignId);
        if (alive && results.length > 0) setItems(results.map(snapshotToOpportunity));
      } catch {
        /* ignore — next tick retries */
      }
    };
    void load();
    const id = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [campaignId, phase]);

  /** Stage/progress reported by the global poller for the campaign on screen. */
  const liveDetail = campaignId ? runSnap.details[campaignId] : undefined;

  // Live "N초 경과" while a search is running (1s tick, only while running).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase !== 'searching') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase]);
  const elapsedLabel = useMemo(() => {
    if (phase !== 'searching' || !times.startedAt) return null;
    const s = Math.max(0, Math.round((now - new Date(times.startedAt).getTime()) / 1000));
    return s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${s % 60}초`;
  }, [phase, times.startedAt, now]);

  /**
   * Start a search. The POST returns a campaignId within ~1s — it never waits for
   * Apify. `force` = 최신 결과로 재검색 (ignores the 24h cache).
   */
  async function runSearch(raw: string, force = false) {
    const q = raw.trim();
    if (!q) return;
    if (phase === 'searching') return; // a run is already in flight
    setInput(q);
    setKeyword(q);
    setError(null);
    setPhase('searching');
    setSelected(new Set());
    setCached(false);
    setItems([]); // clear the previous session so the first batch shows fresh

    const meta = draftMeta.current;
    draftMeta.current = null; // one-shot
    const body: Record<string, unknown> = { query: q, limit: 24, force };
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
          creators?: InstagramCreator[];
          campaignId?: string | null;
          status?: 'running' | 'succeeded' | 'failed' | 'idle';
          cached?: boolean;
          error?: string;
        };
      } | null;
      if (my !== reqId.current) return; // superseded by a newer search

      const data = json?.data;

      // Apify/Supabase unavailable (e.g. signed out) → mock only, never mixed.
      if (data && data.configured === false) {
        setItems(MOCK_ITEMS);
        setSearchedAt(Date.now());
        setPhase('done');
        return;
      }
      if (!data?.campaignId) {
        setError(data?.error ?? '검색을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
        setPhase('done');
        return;
      }

      setCampaignId(data.campaignId);
      setCached(Boolean(data.cached));
      if (data.status === 'succeeded') {
        await openCampaign(data.campaignId); // cache hit → results are already stored
      } else if (data.status === 'failed') {
        setError(data.error ?? '검색이 실패했습니다. 다시 검색해 주세요.');
        setPhase('done');
      } else {
        // running — the global poller drives it to completion, even off this page.
        runStore.setRunStatus(data.campaignId, 'running', q);
        setPhase('searching');
      }
    } catch {
      if (my !== reqId.current) return;
      setError('검색 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.');
      setPhase('done');
    }
  }

  /** 다른 검색 시작 — clear the view only; the campaign and its results stay. */
  const startNewSearch = () => {
    setPhase('idle');
    setItems([]);
    setKeyword('');
    setInput('');
    setCampaignId(null);
    setCached(false);
    setError(null);
    setSelected(new Set());
  };

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

  /** Search sessions for the rail — Campaign-centric, so an AI multi-keyword run
   *  later just shows up as more sessions here. */
  const sessions = useMemo(
    () =>
      [...campaigns]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6)
        .map((c) => ({
          id: c.id,
          query: c.query,
          status: c.status,
          count: c.summary?.discovered ?? c.resultCount ?? 0,
        })),
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
        variant="soft"
        onPick={(c) => void runSearch(c)}
      />

      {/* Search sessions — click restores the Campaign from the DB, never re-runs Apify */}
      {sessions.length > 0 ? (
        <div>
          <RailLabel icon={<Clock className="size-3.5" />}>검색 세션</RailLabel>
          <div className="space-y-1">
            {sessions.map((s) => {
              const active = s.id === campaignId;
              const live = runSnap.statuses[s.id] ?? s.status;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void openCampaign(s.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'dark:hover:bg-muted hover:bg-slate-100',
                  )}
                >
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full',
                      live === 'running'
                        ? 'bg-amber-500'
                        : live === 'failed'
                          ? 'bg-rose-500'
                          : 'bg-emerald-500',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{s.query}</span>
                  <span className="text-muted-foreground shrink-0 text-[11px]">
                    {live === 'running' ? '검색중' : live === 'failed' ? '실패' : `${s.count}명`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
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

  const resultsWorkspace = restoring ? (
    <div>
      <Skeleton className="h-6 w-40 rounded" />
      {skeletons}
    </div>
  ) : phase === 'idle' ? (
    <EmptyState
      className="min-h-[340px] justify-center"
      icon={<Search className="size-5" />}
      title="셀럽을 검색해보세요"
      description="키워드를 입력하거나 추천 키워드를 눌러 검색을 시작하세요."
    />
  ) : phase === 'searching' ? (
    <div>
      {/* Prominent, colorful "searching" banner — hard to miss, reassures the
          user the search keeps running in the background. */}
      <div className="border-primary/20 from-primary/[0.10] via-primary/[0.04] relative overflow-hidden rounded-2xl border bg-gradient-to-br to-transparent p-6">
        <div className="flex items-start gap-3.5">
          <span className="bg-primary text-primary-foreground flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-sm">
            <Loader2 className="size-6 animate-spin" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold tracking-tight">
              <span className="mr-1">{keywordEmoji(keyword)}</span>‘{keyword}’ 셀럽을 찾고 있어요
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              보통 <span className="text-foreground font-semibold">1~2분</span> 걸려요
              {elapsedLabel ? ` · ${elapsedLabel} 경과` : ''}
            </p>
            <p className="text-primary bg-primary/10 mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium">
              <CheckCircle2 className="size-3.5" />
              다른 메뉴를 봐도 괜찮아요 — 다 찾으면 알림으로 알려드려요
            </p>
          </div>
        </div>

        <StageTracker stage={liveDetail?.stage ?? 1} progress={liveDetail?.progress ?? 30} />
      </div>

      {/* First batch arrives while later stages keep running (progressive) */}
      {visible.length > 0 ? (
        <div className="mt-6">
          <p className="text-muted-foreground mb-4 flex items-center gap-2 text-sm">
            <Sparkles className="text-primary size-4" />
            우선 <span className="text-foreground font-semibold">{visible.length}명</span>을
            찾았어요 · 둘러보는 동안 더 찾고 있어요
          </p>
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
        </div>
      ) : (
        skeletons
      )}
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
          {/* Results header — search / re-search are explicit, separate actions */}
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
              {/* 검색 시작 · 완료 · 소요시간 (auto-calculated) */}
              {clock(times.startedAt) ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  검색 시작 {clock(times.startedAt)}
                  {clock(times.completedAt) ? ` · 완료 ${clock(times.completedAt)}` : ''}
                  {durationLabel(times.startedAt, times.completedAt)
                    ? ` · 소요 ${durationLabel(times.startedAt, times.completedAt)}`
                    : ''}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={startNewSearch}>
                <Search className="size-4" />
                다른 검색 시작
              </Button>
              <Button type="button" size="sm" onClick={() => void runSearch(keyword, true)}>
                <RefreshCw className="size-4" />
                최신 결과로 재검색
              </Button>
            </div>
          </div>

          {/* Reused an existing campaign — say so, and offer the fresh path */}
          {cached ? (
            <div className="text-muted-foreground dark:border-border mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/60 px-4 py-2.5 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <History className="size-4" />
                최근 검색 결과를 불러왔습니다 · 최신 데이터가 필요하면 재검색하세요.
              </span>
              {campaignId ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/campaigns/${campaignId}`}>
                    캠페인 보기
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : null}
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
                disabled={phase === 'searching'}
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
            {/* Desktop: a distinct, colored panel that scrolls INTERNALLY so the
                filters at the bottom are always reachable (previously the sticky
                rail could grow taller than the viewport and clip them). */}
            <div className="dark:border-border dark:from-muted/30 mt-4 hidden rounded-2xl border border-violet-200/50 bg-gradient-to-b from-violet-50/70 to-white p-4 lg:block lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto dark:to-transparent">
              {railBody}
            </div>
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
    <p className="dark:text-muted-foreground [&_svg]:text-primary mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
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
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  size?: 'lg' | 'md';
  autoFocus?: boolean;
  /** True while a run is in flight — blocks repeat submits (server dedupes too). */
  disabled?: boolean;
}) {
  const big = size === 'lg';
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onSubmit();
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
          disabled={disabled}
          className={cn(
            'bg-primary text-primary-foreground hover:bg-primary/90 absolute right-2 inline-flex items-center justify-center rounded-xl transition-colors',
            big ? 'size-11' : 'right-1.5 size-8 rounded-lg',
            disabled && 'pointer-events-none opacity-50',
          )}
        >
          {disabled ? (
            <Loader2 className={cn('animate-spin', big ? 'size-5' : 'size-4')} />
          ) : (
            <ArrowRight className={big ? 'size-5' : 'size-4'} />
          )}
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
            'dark:text-muted-foreground [&_svg]:text-primary mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500',
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
                : 'bg-primary/10 text-primary hover:bg-primary/20 font-medium',
            )}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
