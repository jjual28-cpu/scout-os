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
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Store,
  Tag,
  TriangleAlert,
  UserRound,
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
import { splitTokens } from '@/features/products/types';
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

/** A stored campaign_results snapshot → the same card shape the live search uses.
 *  Carries the AI verdict through so Discover can filter/rank/explain by fit. */
function snapshotToOpportunity(s: CampaignResult): DiscoverOpportunity {
  // 저장 스냅샷엔 platform 컬럼이 없으므로 external_id 접두어로 판별(tiktok:/youtube:/…).
  const platform: InstagramCreator['platform'] = s.externalId.startsWith('tiktok:')
    ? 'tiktok'
    : s.externalId.startsWith('youtube:')
      ? 'youtube'
      : 'instagram';
  const creator: InstagramCreator = {
    id: s.externalId,
    platform,
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
    lastPostAt: s.lastPostAt ?? null,
    recentAvgLikes: s.recentAvgLikes ?? null,
    recentAvgComments: s.recentAvgComments ?? null,
    rawData: null,
  };
  return {
    ...toDiscoverOpportunity(creator),
    aiScore: s.aiScore ?? null,
    aiVerdict: s.aiVerdict ?? null,
    aiReason: s.aiReason ?? null,
    aiAudience: s.aiAudience ?? null,
    visualScore: s.visualScore ?? null,
    visualVerdict: s.visualVerdict ?? null,
    visualReason: s.visualReason ?? null,
  };
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
  { id: 'tiktok', label: 'TikTok', icon: Music2, enabled: true },
  { id: 'youtube', label: 'YouTube', icon: Youtube, enabled: true },
] as const;

type Phase = 'idle' | 'searching' | 'done';

/** How long the UI waits before declaring a search dead. Mirrors the server's
 *  own stale window (status route STALE_MS) so the two agree. */
const STALL_MS = 10 * 60 * 1000;

/** Two discovery entrances. `tagged` finds creators who already tag a brand —
 *  proof they do brand work, which a hashtag match can't tell you. */
type SearchMode = 'keyword' | 'tagged';

/**
 * What the user is hunting. The same word means opposite searches: "바디케어"
 * as `creator` finds reviewers to pitch, as `brand` finds the shops themselves —
 * and each rejects what the other wants. The server judges by this, so getting
 * it wrong throws away precisely the results the user came for.
 */
type SearchTarget = 'creator' | 'brand' | 'gonggu';

const TARGET_KEY = 'scout:search-target';

function readStoredTarget(): SearchTarget | null {
  try {
    const v = localStorage.getItem(TARGET_KEY);
    return v === 'brand' || v === 'gonggu' ? v : 'creator';
  } catch {
    return null; // storage blocked (private mode / embedded) — just use the default
  }
}

function storeTarget(t: SearchTarget): void {
  try {
    localStorage.setItem(TARGET_KEY, t);
  } catch {
    // preference not remembered — harmless, the search still runs
  }
}

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
type SortKey = 'recommended' | 'visual' | 'engagement' | 'followers' | 'recent' | 'posts';
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'recommended', label: 'AI 추천순' },
  { id: 'visual', label: '비주얼 적합순' },
  { id: 'engagement', label: '참여율순' },
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

/** 팔로워 규모 밴드 — 원하는 인플루언서 등급만 결과에서 보기(마케팅 통용 구간). */
type SizeBand = 'all' | 'nano' | 'micro' | 'mid' | 'macro';
const SIZE_BANDS: { id: SizeBand; label: string; test: (f: number) => boolean }[] = [
  { id: 'all', label: '전체', test: () => true },
  { id: 'nano', label: '나노 1천~1만', test: (f) => f >= 1_000 && f < 10_000 },
  { id: 'micro', label: '마이크로 1만~10만', test: (f) => f >= 10_000 && f < 100_000 },
  { id: 'mid', label: '미들 10만~50만', test: (f) => f >= 100_000 && f < 500_000 },
  { id: 'macro', label: '매크로 50만+', test: (f) => f >= 500_000 },
];
const SIZE_BAND_KEY = 'scout:size-band';

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
  { n: 1, label: '후보 수집' },
  { n: 2, label: '게시물·활동 분석' },
  { n: 3, label: '업체 거르고 진짜 영향력 판단' },
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
  /** Non-fatal AI notice (판정/검색어 변환 실패) — search still succeeded. */
  const [aiError, setAiError] = useState<string | null>(null);
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
  // 이미 연락한 셀럽도 기본으로 보인다 — 조용히 사라지면 헷갈린다는 피드백. 토글로 숨김 가능.
  const [hideHandled, setHideHandled] = useState(false);
  /** Hide the accounts AI judged as not a real fit. On by default. */
  const [hideRejected, setHideRejected] = useState(true);
  /** 제외 키워드 — 아이디/이름/소개/카테고리에 이 단어가 있으면 결과에서 숨긴다. */
  const [excludeTerms, setExcludeTerms] = useState<string[]>([]);
  const [excludeInput, setExcludeInput] = useState('');
  /** 비주얼(이미지) 판정 — 옵션. 조건 입력 + 실행 상태 + 부적합 숨김. */
  const [visualOpen, setVisualOpen] = useState(false);
  const [visualCriteria, setVisualCriteria] = useState('');
  const [visualLoading, setVisualLoading] = useState(false);
  const [hideVisualReject, setHideVisualReject] = useState(false);
  /** 국가 필터 — 전체 / 한국(한글 감지) / 해외. */
  const [region, setRegion] = useState<'all' | 'kr' | 'foreign'>('all');
  /** 팔로워 규모 밴드 — 원하는 등급만 결과에서 본다. localStorage로 기억. */
  const [sizeBand, setSizeBand] = useState<SizeBand>('all');
  useEffect(() => {
    try {
      const v = localStorage.getItem(SIZE_BAND_KEY);
      if (v && SIZE_BANDS.some((b) => b.id === v)) setSizeBand(v as SizeBand);
    } catch {
      /* storage blocked — just use 전체 */
    }
  }, []);
  const chooseSizeBand = (b: SizeBand) => {
    setSizeBand(b);
    try {
      localStorage.setItem(SIZE_BAND_KEY, b);
    } catch {
      /* preference not remembered — harmless */
    }
  };

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  /** Competitor/brand handle for the tagged entrance. */
  const [rival, setRival] = useState('');
  /** 여러 키워드로 한 번에 찾기 — 칩 입력. */
  const [multiKw, setMultiKw] = useState<string[]>([]);
  const [multiInput, setMultiInput] = useState('');
  const addMultiKw = (raw: string) => {
    const t = raw.trim().replace(/,$/, '').trim();
    if (!t) return;
    setMultiKw((prev) => (prev.includes(t) || prev.length >= 6 ? prev : [...prev, t]));
    setMultiInput('');
  };
  const runMultiSearch = () => {
    if (phase === 'searching' || multiKw.length < 2) return;
    void runSearch(multiKw.join(', '), false, 'keyword', multiKw);
  };
  /**
   * Who this search is for. Most users hunt creators, so that's the default —
   * but someone who hunts brands does it every time, so the last choice sticks.
   * Read after mount: localStorage doesn't exist during SSR.
   */
  const [target, setTarget] = useState<SearchTarget>('creator');
  useEffect(() => {
    if (readStoredTarget() === 'brand') setTarget('brand');
  }, []);
  const chooseTarget = (t: SearchTarget) => {
    setTarget(t);
    storeTarget(t);
  };

  const saved = useSavedOpportunities();
  const outreach = useOutreach();
  const products = useProducts();
  const { campaigns } = useCampaigns();

  /** Competitor handles saved on the currently-selected product → one-click tagged search. */
  const selectedCompetitors = useMemo(
    () =>
      splitTokens(
        products.products.find((p) => p.id === selectedProductId)?.competitorHandles ?? '',
      ),
    [products.products, selectedProductId],
  );

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
        .select('id,query,status,error,ai_error,created_at,completed_at,started_at,search_target')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!row) return false;
      const c = row as unknown as {
        id: string;
        query: string;
        status: 'running' | 'succeeded' | 'failed';
        error: string | null;
        ai_error: string | null;
        created_at: string;
        completed_at: string | null;
        started_at: string | null;
        search_target: string | null;
      };
      setAiError(c.ai_error);
      // 토글은 '보고 있는 캠페인이 무슨 목적으로 검색됐는지'를 보여줘야 한다. 안 그러면
      // AI 직원(공구)으로 넘어와도 이전 로컬 선택(셀럽)이 남아 잘못 표시된다.
      if (c.search_target === 'gonggu' || c.search_target === 'brand') setTarget(c.search_target);
      else if (c.search_target === 'creator') setTarget('creator');

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

  /** Stop a running search and release its lock so the term can be searched again. */
  const cancelSearch = useCallback(async (id: string, reason: string) => {
    try {
      await fetch(`/api/campaigns/${id}/cancel`, { method: 'POST' });
    } catch {
      /* the campaign may already be finished — the UI still moves on */
    }
    runStore.setRunStatus(id, 'failed');
    setPhase('done');
    setError(reason);
  }, []);

  /**
   * Client-side give-up. Finishing a search depends on the poller reaching the
   * status route; if any link in that chain misbehaves the screen would sit on
   * "검색 중" indefinitely (it once showed 30분 경과). The UI refuses to lie —
   * past the server's own stale window it cancels and says so.
   */
  const gaveUp = useRef(false);
  useEffect(() => {
    if (phase !== 'searching') {
      gaveUp.current = false;
      return;
    }
    if (!campaignId || !times.startedAt || gaveUp.current) return;
    const startedMs = new Date(times.startedAt).getTime();
    if (!Number.isFinite(startedMs) || now - startedMs <= STALL_MS) return;
    gaveUp.current = true;
    void cancelSearch(campaignId, '검색이 너무 오래 걸려 중단했어요. 다시 검색해 주세요.');
  }, [phase, campaignId, times.startedAt, now, cancelSearch]);

  /**
   * Start a search. The POST returns a campaignId within ~1s — it never waits for
   * Apify. `force` = 최신 결과로 재검색 (ignores the 24h cache).
   */
  async function runSearch(
    raw: string,
    force = false,
    mode: SearchMode = 'keyword',
    keywords?: string[],
  ) {
    const q = raw.trim();
    if (!q) return;
    if (phase === 'searching') return; // a run is already in flight
    setInput(q);
    setKeyword(q);
    setError(null);
    setAiError(null);
    setPhase('searching');
    setSelected(new Set());
    setCached(false);
    setItems([]); // clear the previous session so the first batch shows fresh
    // 새 검색은 항상 전체로 — 이전에 걸어둔(또는 저장된) 좁히는 필터가 결과를 몰래
    // 숨기지 않게 초기화한다. 품질 자동 제외(가짜·저참여·업체)는 계속 유지.
    setBuckets(new Set());
    setToggles(new Set());
    setRegion('all');
    chooseSizeBand('all');
    setExcludeTerms([]);
    setHideRejected(true);
    setHideHandled(false);
    setHideVisualReject(false);

    const meta = draftMeta.current;
    draftMeta.current = null; // one-shot
    // tagged is inherently a creator hunt — the server pins it, we just agree.
    const body: Record<string, unknown> = {
      query: q,
      limit: 30,
      force,
      mode,
      target: mode === 'tagged' ? 'creator' : target,
    };
    // 틱톡·유튜브는 태그 모드가 없어 keyword 검색만. (플랫폼 미지정=인스타)
    if ((platform === 'tiktok' || platform === 'youtube') && mode === 'keyword')
      body.platform = platform;
    if (keywords && keywords.length > 1) body.keywords = keywords;
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
    setAiError(null);
    setSelected(new Set());
  };

  // Creators hidden ONLY because they're already handled (연락완료/답변/협업/제외).
  // The DB keeps the full result set — this filter is screen-only.
  const hiddenHandledCount = useMemo(
    () => items.filter((it) => isDefaultHidden(outreach.records[it.id]?.status)).length,
    [items, outreach.records],
  );

  // Accounts the AI judged as not a real fit (info/news/unrelated). Hidden by
  // default — that's the whole point of the matching layer — but never deleted,
  // so the user can always look at what was filtered out.
  const aiRejectedCount = useMemo(
    () => items.filter((it) => it.aiVerdict === 'reject').length,
    [items],
  );

  // Filter + sort (client-side, over the current result set)
  const visible = useMemo(() => {
    const filtered = items.filter((it) => {
      if (hideRejected && it.aiVerdict === 'reject') return false;
      if (hideHandled && isDefaultHidden(outreach.records[it.id]?.status)) return false;
      const f = it.followersCount ?? 0;
      if (buckets.size && ![...buckets].some((b) => inBucket(f, b))) return false;
      if (toggles.has('verified') && !it.isVerified) return false;
      if (toggles.has('business') && !it.category) return false;
      if (toggles.has('bio') && !it.biography?.trim()) return false;
      if (toggles.has('email') && !it.email) return false;
      if (excludeTerms.length) {
        const hay =
          `${it.handle} ${it.name} ${it.biography ?? ''} ${it.category ?? ''}`.toLowerCase();
        if (excludeTerms.some((t) => hay.includes(t))) return false;
      }
      if (hideVisualReject && it.visualVerdict === 'reject') return false;
      // 가짜 팔로워 의심·참여율 낮은 계정은 항상 자동 제외(사용자 토글 없음).
      if (it.fakeSuspect) return false;
      if (it.lowEngagement) return false;
      if (region === 'kr' && !it.koreanLikely) return false;
      if (region === 'foreign' && it.koreanLikely) return false;
      // 팔로워 규모 밴드 — 선택한 등급만.
      if (sizeBand !== 'all') {
        const band = SIZE_BANDS.find((b) => b.id === sizeBand);
        if (band && !band.test(it.followersCount ?? 0)) return false;
      }
      return true;
    });
    const arr = [...filtered];
    if (sort === 'followers') arr.sort((a, b) => (b.followersCount ?? 0) - (a.followersCount ?? 0));
    else if (sort === 'posts') arr.sort((a, b) => (b.postsCount ?? 0) - (a.postsCount ?? 0));
    else if (sort === 'engagement')
      arr.sort((a, b) => (b.engagementRate ?? -1) - (a.engagementRate ?? -1));
    else if (sort === 'visual')
      // 비주얼 판정 점수 우선(판정 안 된 건 뒤로), 그다음 AI 점수.
      arr.sort(
        (a, b) =>
          (b.visualScore ?? -1) - (a.visualScore ?? -1) || (b.aiScore ?? -1) - (a.aiScore ?? -1),
      );
    else if (sort === 'recommended')
      // AI fit leads; unjudged results fall back to the old rule-based order so
      // a search without AI still ranks sensibly.
      arr.sort(
        (a, b) =>
          (b.aiScore ?? -1) - (a.aiScore ?? -1) ||
          (b.reasons?.length ?? 0) - (a.reasons?.length ?? 0) ||
          (b.followersCount ?? 0) - (a.followersCount ?? 0),
      );
    // 'recent' keeps the original discovery order
    return arr;
  }, [
    items,
    buckets,
    toggles,
    sort,
    hideHandled,
    hideRejected,
    hideVisualReject,
    region,
    sizeBand,
    excludeTerms,
    outreach.records,
  ]);

  /** 비주얼 판정된 결과가 하나라도 있는지 (판정순·부적합숨김 UI 노출 여부). */
  const visualJudgedCount = useMemo(
    () => items.filter((it) => it.visualVerdict != null).length,
    [items],
  );
  /** 가짜 팔로워 의심 계정 수 (있으면 숨김 칩 노출). */
  const fakeCount = useMemo(() => items.filter((it) => it.fakeSuspect).length, [items]);
  /** 참여율 낮은(죽은) 계정 수 (있으면 숨김 칩 노출). */
  const lowEngagementCount = useMemo(() => items.filter((it) => it.lowEngagement).length, [items]);
  /** 한국 추정 셀럽 수 (한글 감지). 국가 필터·문구 노출 판단용. */
  const koreanCount = useMemo(() => items.filter((it) => it.koreanLikely).length, [items]);
  /** 한국·해외가 섞여 있을 때만 국가 구분이 의미 있음(둘 다 1명 이상). */
  const regionMixed = koreanCount > 0 && koreanCount < items.length;
  /** 결과가 어느 플랫폼에서 왔는지(헤더 표기). 스냅샷은 external_id 접두어로 판별됨. */
  const resultPlatformLabel = useMemo(() => {
    const first = items[0]?.platform;
    if (!first) return 'Instagram';
    const label: Record<string, string> = {
      instagram: 'Instagram',
      tiktok: 'TikTok',
      youtube: 'YouTube',
      blog: 'Blog',
    };
    return items.every((it) => it.platform === first)
      ? (label[first] ?? 'Instagram')
      : '여러 플랫폼';
  }, [items]);

  const summary = useMemo(() => summarizeResults(items), [items]);
  /** 표시 중 결과의 평균 참여율(%). 없으면 null. */
  const avgEngagement = useMemo(() => {
    const ers = items
      .map((it) => it.engagementRate)
      .filter((n): n is number => typeof n === 'number');
    return ers.length ? Math.round((ers.reduce((s, x) => s + x, 0) / ers.length) * 10) / 10 : null;
  }, [items]);

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
  const addExclude = (raw: string) => {
    const t = raw.trim().replace(/,$/, '').trim().toLowerCase();
    if (!t) return;
    setExcludeTerms((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setExcludeInput('');
  };
  const removeExclude = (t: string) => setExcludeTerms((prev) => prev.filter((x) => x !== t));

  /** 사용자가 만질 수 있는 필터를 전부 기본값으로. (규모·국가·제외어·숨김 토글 등)
   *  가짜·저참여 자동 제외는 품질 보호라 여기서 되돌리지 않는다. */
  const resetFilters = () => {
    setBuckets(new Set());
    setToggles(new Set());
    setHideRejected(false);
    setHideHandled(false);
    setHideVisualReject(false);
    setRegion('all');
    chooseSizeBand('all');
    setExcludeTerms([]);
  };
  /** 기본으로 숨겨둔 셀럽(이미 연락·AI 부적합·비주얼 부적합)을 이 화면에서 다시 보이게. */
  const revealHidden = () => {
    setHideRejected(false);
    setHideHandled(false);
    setHideVisualReject(false);
  };
  /** 사용자 필터가 하나라도 켜져 있는지 — 빈 결과 안내에서 '초기화' 노출 판단. */
  const anyFilterActive =
    buckets.size > 0 ||
    toggles.size > 0 ||
    hideRejected ||
    hideHandled ||
    hideVisualReject ||
    region !== 'all' ||
    sizeBand !== 'all' ||
    excludeTerms.length > 0;

  /** 옵션 비주얼 판정 — 상위 후보 사진을 비전 AI가 보고 조건에 맞는지 점수. */
  const runVisual = async () => {
    if (!campaignId || visualLoading || !visualCriteria.trim()) return;
    setVisualLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/visual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria: visualCriteria.trim() }),
      });
      const json = (await res.json().catch(() => null)) as {
        data?: { judged?: number; fit?: number };
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        setError(json?.error?.message ?? '비주얼 판정에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      await openCampaign(campaignId); // reload results with visual_*
      setSort('visual');
      setVisualOpen(false);
    } catch {
      setError('비주얼 판정 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setVisualLoading(false);
    }
  };
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

      {/* The high-signal entrance: whoever tags a brand already does brand work. */}
      <div>
        <RailLabel icon={<Tag className="size-3.5" />}>경쟁 브랜드로 셀럽 찾기</RailLabel>
        <p className="text-muted-foreground mb-2 text-[11px] leading-snug">
          경쟁 브랜드의 인스타 아이디를 넣으면,{' '}
          <span className="text-foreground">그 브랜드를 홍보(태그)해 본 셀럽</span>을 찾아드려요.
          이미 협찬 경험이 있어 제안 성공률이 높아요. (경쟁 브랜드를 찾는 게 아니에요)
        </p>
        <div className="flex gap-1.5">
          <input
            value={rival}
            onChange={(e) => setRival(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runSearch(rival, false, 'tagged');
            }}
            placeholder="@경쟁사계정"
            className={cn(RAIL_FIELD, 'flex-1')}
            aria-label="경쟁사 인스타그램 계정"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void runSearch(rival, false, 'tagged')}
            disabled={phase === 'searching' || rival.trim().length < 2}
          >
            찾기
          </Button>
        </div>
        {selectedCompetitors.length > 0 ? (
          <div className="mt-2.5">
            <p className="text-muted-foreground mb-1.5 text-[11px]">이 상품에 저장된 경쟁사</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedCompetitors.map((handle) => (
                <button
                  key={handle}
                  type="button"
                  disabled={phase === 'searching'}
                  onClick={() => void runSearch(handle, false, 'tagged')}
                  className="border-input bg-background hover:bg-muted inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:pointer-events-none disabled:opacity-50"
                >
                  <Tag className="size-3" />@{handle.replace(/^@/, '')}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <ChipRow
        icon={<TrendingUp className="size-3.5" />}
        label="추천 키워드"
        chips={POPULAR}
        variant="soft"
        onPick={(c) => void runSearch(c)}
      />

      {/* 여러 키워드로 한 번에 — 여러 분야를 한 검색에서 모아 수집 다양성↑ */}
      <div>
        <RailLabel icon={<SlidersHorizontal className="size-3.5" />}>여러 키워드로 찾기</RailLabel>
        <p className="text-muted-foreground mb-2 text-[11px] leading-snug">
          2개 이상 넣으면 그 분야들을 <span className="text-foreground">한 번에</span> 훑어 더 많은
          셀럽을 찾아요.
        </p>
        <div className="border-input bg-background focus-within:ring-ring mb-2 flex flex-wrap items-center gap-1 rounded-lg border px-2 py-1.5 focus-within:ring-2">
          {multiKw.map((t) => (
            <span
              key={t}
              className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
            >
              {t}
              <button
                type="button"
                onClick={() => setMultiKw((prev) => prev.filter((x) => x !== t))}
                aria-label={`${t} 삭제`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            value={multiInput}
            onChange={(e) => setMultiInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addMultiKw(multiInput);
              } else if (e.key === 'Backspace' && !multiInput && multiKw.length) {
                setMultiKw((prev) => prev.slice(0, -1));
              }
            }}
            onBlur={() => addMultiKw(multiInput)}
            placeholder={multiKw.length ? '' : '예: 뷰티, 메이크업, 헤어'}
            className="min-w-[80px] flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={runMultiSearch}
          disabled={phase === 'searching' || multiKw.length < 2}
        >
          <Search className="size-4" />
          {multiKw.length >= 2 ? `${multiKw.length}개 키워드로 찾기` : '키워드 2개 이상'}
        </Button>
      </div>

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
          {/* 팔로워 규모 지정 — 원하는 인플루언서 등급만 결과에서 본다(선택 기억됨). */}
          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px]">팔로워 규모</p>
            <div className="flex flex-wrap gap-1.5">
              {SIZE_BANDS.map((b) => (
                <FilterChip
                  key={b.id}
                  active={sizeBand === b.id}
                  onClick={() => chooseSizeBand(b.id)}
                >
                  {b.label}
                </FilterChip>
              ))}
            </div>
          </div>
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
          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] leading-snug">
              제외 키워드 — 아이디·이름·소개에 이 단어가 있으면 숨겨요 (예: 도매, 공구)
            </p>
            <div className="border-input bg-background focus-within:ring-ring flex flex-wrap items-center gap-1 rounded-lg border px-2 py-1.5 focus-within:ring-2">
              {excludeTerms.map((t) => (
                <span
                  key={t}
                  className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeExclude(t)}
                    aria-label={`${t} 제외 해제`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                value={excludeInput}
                onChange={(e) => setExcludeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addExclude(excludeInput);
                  } else if (e.key === 'Backspace' && !excludeInput && excludeTerms.length) {
                    removeExclude(excludeTerms[excludeTerms.length - 1]!);
                  }
                }}
                onBlur={() => addExclude(excludeInput)}
                placeholder={excludeTerms.length ? '' : '단어 입력 후 Enter'}
                className="min-w-[80px] flex-1 bg-transparent text-sm outline-none"
                aria-label="제외 키워드 입력"
              />
            </div>
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
            {/* Title stays a clean sentence — the query can be a whole request
                ("신생 바디케어 브랜드 찾아줘"), so it reads as a quote below. */}
            <p className="text-lg font-semibold tracking-tight">셀럽을 찾고 있어요</p>
            <p className="text-foreground/80 mt-1 truncate text-sm">
              <span className="mr-1">{keywordEmoji(keyword)}</span>
              {keyword}
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
          {/* Always an escape hatch — a search must never hold the user hostage. */}
          {campaignId ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => void cancelSearch(campaignId, '검색을 중단했어요.')}
            >
              <X className="size-4" />
              중단
            </Button>
          ) : null}
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

      {aiError ? (
        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{aiError}</span>
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
                {resultPlatformLabel} · 셀럽{' '}
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
              <Button
                type="button"
                size="sm"
                variant={visualOpen ? 'default' : 'outline'}
                onClick={() => setVisualOpen((v) => !v)}
                className={visualOpen ? '' : 'border-primary/40 text-primary'}
              >
                <Sparkles className="size-4" />
                비주얼로 보기
              </Button>
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

          {/* 비주얼 판정 패널 — 결과 바로 위(잘 보이게). 제품 관련 시각 기준으로 사진 판정(옵션·비용) */}
          {visualOpen ? (
            <div className="border-primary/30 bg-primary/[0.05] mb-5 rounded-xl border p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="text-primary size-4" />
                비주얼로 셀럽 찾기
              </p>
              <p className="text-muted-foreground mb-2.5 text-xs leading-snug">
                제품에 맞는 <span className="text-foreground font-medium">시각 조건</span>을 쓰면,
                상위 후보들의 프로필·게시물{' '}
                <span className="text-foreground font-medium">사진</span>을 AI가 보고 얼마나 맞는지
                점수를 매겨요. (사진 판정이라 AI 사용량이 늘어요)
              </p>
              <div className="flex gap-2">
                <input
                  value={visualCriteria}
                  onChange={(e) => setVisualCriteria(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void runVisual();
                    }
                  }}
                  disabled={visualLoading}
                  placeholder="예: 머리 길고 윤기나는 여성"
                  className="border-input bg-background focus-visible:ring-ring h-10 flex-1 rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 disabled:opacity-50"
                />
                <Button
                  type="button"
                  onClick={() => void runVisual()}
                  disabled={visualLoading || !visualCriteria.trim()}
                  className="shrink-0"
                >
                  {visualLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {visualLoading ? '판정 중…' : '비주얼 판정'}
                </Button>
              </div>
            </div>
          ) : null}

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

          {/* 포지셔닝 — 우리는 그냥 키워드 검색이 아니라는 걸 결과에서 분명히 보여준다 */}
          <div className="border-primary/20 bg-primary/[0.04] mb-5 rounded-xl border p-3.5">
            <p className="text-primary flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="size-4" />
              단순 키워드 검색이 아니에요
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Scout OS는{' '}
              <span className="text-foreground font-medium">판매자·정보성 계정을 걸러내고</span>,
              팔로워 대비 <span className="text-foreground font-medium">참여율로 진짜 영향력</span>
              을 판단하며,{' '}
              <span className="text-foreground font-medium">가짜 팔로워·죽은 계정</span>을 걸러내고,{' '}
              <span className="text-foreground font-medium">한국·해외 셀럽까지 구분</span>해
              골라냈어요.
              {aiRejectedCount > 0 ? ` · 업체·부적합 ${aiRejectedCount}곳 제외` : ''}
              {fakeCount > 0 ? ` · 가짜 의심 ${fakeCount}명 제외` : ''}
              {lowEngagementCount > 0 ? ` · 참여율 낮은 ${lowEngagementCount}명 제외` : ''}
              {regionMixed
                ? ` · 한국 ${koreanCount}명 / 해외 ${items.length - koreanCount}명 구분`
                : ''}
              {avgEngagement != null ? ` · 평균 참여율 ${avgEngagement}%` : ''}
            </p>
          </div>

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
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {aiRejectedCount > 0 ? (
              <FilterChip active={!hideRejected} onClick={() => setHideRejected((v) => !v)}>
                <Sparkles className="size-3.5" />
                AI가 거른 {aiRejectedCount}명 {hideRejected ? '숨김' : '표시 중'}
              </FilterChip>
            ) : null}
            {hiddenHandledCount > 0 ? (
              <FilterChip active={!hideHandled} onClick={() => setHideHandled((v) => !v)}>
                <EyeOff className="size-3.5" />
                이미 연락한 {hiddenHandledCount}명 {hideHandled ? '숨김' : '표시 중'}
              </FilterChip>
            ) : null}
            {visualJudgedCount > 0 ? (
              <FilterChip active={hideVisualReject} onClick={() => setHideVisualReject((v) => !v)}>
                <Sparkles className="size-3.5" />
                비주얼 부적합 {hideVisualReject ? '숨김' : '표시 중'}
              </FilterChip>
            ) : null}
            {/* 가짜 팔로워·저참여 계정은 토글 없이 항상 자동 제외 (배너에 제외 수만 표기). */}
            {/* 국가 필터 — 한글 감지로 한국/해외 추정. 외국 셀럽을 원하는 경우도 있어 3택. */}
            <div
              className="dark:border-border inline-flex items-center overflow-hidden rounded-full border border-slate-200/70 text-xs"
              title="이름·소개의 한글을 감지해 한국/해외 셀럽을 구분합니다 (추정). 틱톡 등 글로벌 결과에서 원하는 국적만 골라보세요."
            >
              {(
                [
                  ['all', '전체'],
                  ['kr', '🇰🇷 한국'],
                  ['foreign', '🌐 해외'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRegion(id)}
                  className={cn(
                    'px-2.5 py-1 transition-colors',
                    region === id
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
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

          {/* 왜 전부 안 보이는지 항상 설명 — 기본 숨김(이미 연락·AI 부적합 등)을 투명하게 */}
          {visible.length > 0 && visible.length < items.length ? (
            <div className="dark:border-border mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/60 bg-slate-50/60 px-4 py-2.5 text-sm dark:bg-transparent">
              <span className="text-muted-foreground">
                <span className="text-foreground font-medium">{items.length}명</span> 중{' '}
                <span className="text-foreground font-medium">{visible.length}명</span> 표시 중
                <span className="text-muted-foreground/90">
                  {' '}
                  · 숨김:
                  {hideHandled && hiddenHandledCount > 0 ? ` 이미 연락 ${hiddenHandledCount}` : ''}
                  {hideRejected && aiRejectedCount > 0 ? ` · AI 부적합 ${aiRejectedCount}` : ''}
                  {lowEngagementCount > 0 ? ` · 참여율 낮음 ${lowEngagementCount}` : ''}
                  {fakeCount > 0 ? ` · 가짜 의심 ${fakeCount}` : ''}
                </span>
              </span>
              {(hideHandled && hiddenHandledCount > 0) ||
              (hideRejected && aiRejectedCount > 0) ||
              (hideVisualReject && visualJudgedCount > 0) ? (
                <Button type="button" variant="outline" size="sm" onClick={revealHidden}>
                  <Sparkles className="size-3.5" />
                  숨긴 셀럽도 보기
                </Button>
              ) : null}
            </div>
          ) : null}

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
            <div className="dark:border-border flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-slate-200/60 p-8 text-center">
              <SearchX className="text-muted-foreground size-6" />
              <p className="mt-3 font-medium">
                {items.length}명을 찾았지만, 지금 필터에 다 가려졌어요
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {anyFilterActive
                  ? '팔로워 규모·국가·제외 키워드 같은 필터가 결과를 숨기고 있어요. 초기화하면 다시 보여요.'
                  : '조건을 조금 바꾸거나 다시 검색해 보세요.'}
              </p>
              {anyFilterActive ? (
                <Button type="button" className="mt-4" onClick={resetFilters}>
                  <RefreshCw className="size-4" />
                  필터 초기화하고 전체 보기
                </Button>
              ) : null}
            </div>
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

        {/* 검색 목적 — 무엇을 찾을지가 검색의 전부를 결정하므로 맨 위에 크게. */}
        <div className="mb-6">
          <p className="text-muted-foreground mb-2 text-xs font-medium">무엇을 찾을까요?</p>
          <TargetToggle
            target={target}
            onSelect={chooseTarget}
            disabled={phase === 'searching'}
            prominent
          />
        </div>

        <div className="gap-8 lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* ── Search Rail ── */}
          <aside className="lg:sticky lg:top-[76px] lg:self-start">
            <div className="space-y-3">
              <SearchField
                value={input}
                size="md"
                target={target}
                onChange={setInput}
                onSubmit={() => void runSearch(input)}
                disabled={phase === 'searching'}
              />
              {/* Users type like they're asking an assistant — say so, since the
                  box looks like an ordinary keyword field. */}
              <p className="text-muted-foreground flex items-start gap-1.5 text-[11px] leading-snug">
                <Sparkles className="text-primary mt-px size-3 shrink-0" />
                <span>
                  AI에게 말하듯 문장으로 써도 돼요. AI가 인스타에서 찾을 수 있는 키워드로 바꿔서
                  검색해요.
                </span>
              </p>
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
  target = 'creator',
  autoFocus,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  size?: 'lg' | 'md';
  /** Only shapes the example — the toggle above already states the choice. */
  target?: SearchTarget;
  autoFocus?: boolean;
  /** True while a run is in flight — blocks repeat submits (server dedupes too). */
  disabled?: boolean;
}) {
  const big = size === 'lg';
  const placeholder =
    target === 'brand' ? '예: 신생 비건 바디케어 브랜드' : '예: 요즘 뜨는 셀럽 찾아줘';
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
          placeholder={placeholder}
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

const TARGETS: { id: SearchTarget; label: string; icon: typeof UserRound; hint: string }[] = [
  { id: 'creator', label: '셀럽 찾기', icon: UserRound, hint: '협업 제안할 크리에이터를 찾아요' },
  {
    id: 'gonggu',
    label: '공구전문',
    icon: ShoppingCart,
    hint: '공동구매를 돌리는 셀러를 찾아요 (소개글의 공구 일정·주문 안내로 판별)',
  },
  { id: 'brand', label: '브랜드 찾기', icon: Store, hint: '제품을 파는 브랜드 계정을 찾아요' },
];

/**
 * The one choice that decides what the whole search means. It sits above the
 * box rather than beside it because picking it after typing is picking it too
 * late — the AI plans different hashtags per target, not just different verdicts.
 */
function TargetToggle({
  target,
  onSelect,
  disabled,
  prominent,
}: {
  target: SearchTarget;
  onSelect: (t: SearchTarget) => void;
  disabled?: boolean;
  /** 큰 카드형(전체 너비) — 검색 위 상단에 눈에 띄게 배치할 때. */
  prominent?: boolean;
}) {
  const hint = TARGETS.find((t) => t.id === target)?.hint ?? '';

  // 상단 배치용 큰 3택 카드 — 아이콘·라벨·설명을 카드 안에 크게.
  if (prominent) {
    return (
      <div role="group" aria-label="검색 대상" className="grid gap-2.5 sm:grid-cols-3">
        {TARGETS.map((t) => {
          const active = target === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onSelect(t.id)}
              className={cn(
                'flex flex-col items-start gap-1.5 rounded-2xl border p-4 text-left transition-all',
                active
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'dark:border-border bg-card hover:border-primary/50 hover:bg-primary/5 border-slate-200/70',
                disabled && 'pointer-events-none opacity-50',
              )}
            >
              <span className="flex items-center gap-2">
                <Icon className={cn('size-5', active ? '' : 'text-primary')} />
                <span className="text-base font-bold">{t.label}</span>
              </span>
              <span
                className={cn(
                  'text-xs leading-snug',
                  active ? 'text-primary-foreground/85' : 'text-muted-foreground',
                )}
              >
                {t.hint}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        role="group"
        aria-label="검색 대상"
        className="bg-card grid grid-cols-3 gap-0.5 rounded-full border p-1"
      >
        {TARGETS.map((t) => {
          const active = target === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onSelect(t.id)}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
                disabled && 'pointer-events-none opacity-50',
              )}
            >
              <Icon className="size-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground px-1 text-[11px] leading-snug">{hint}</p>
    </div>
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
