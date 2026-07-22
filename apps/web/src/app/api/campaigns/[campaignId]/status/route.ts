import { type NextRequest } from 'next/server';

import { type InstagramCreator } from '@/features/search/instagram';
import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';
import { aiErrorMessage } from '@/services/ai/errors';
import { matchCreators, type BrandContext, type SearchTarget } from '@/services/ai/match';
import { getPooled, upsertPool } from '@/services/apify/creator-pool';
import {
  authorsFromPosts,
  getRunStatus,
  profilesFromItems,
  readDataset,
  SEARCH_MIN_SUFFICIENT,
  stage2Input,
  stage3Cap,
  stage3Input,
  startActorRun,
} from '@/services/apify/instagram';
import { creatorsFromTiktok } from '@/services/apify/tiktok';
import { creatorsFromYoutube } from '@/services/apify/youtube';

/** Trending searches must not reuse cached profiles — recency has to be live. */
const TREND_RE = /요즘|뜨는|트렌드|대세|핫한|떠오르|라이징/;

/**
 * 크리에이터 검색에서 Stage 1(계정 이름 검색)이 데려오는 "판매자/브랜드" 계정을
 * 걸러낸다. 셀럽은 아이디에 제품명을 안 넣지만, 그 제품을 파는 브랜드/샵은 넣는다
 * (예: 검색어 '샴푸' → @ts_shampoo_official, 샴푸의 제이팝). 이런 계정은 협찬받을
 * 셀럽이 아니므로 제외하고, 그러면 자연히 해시태그→작성자 단계로 넘어가 진짜
 * 크리에이터를 찾는다. `target === 'brand'` 검색에는 적용하지 않는다.
 */
const SELLER_SIGNALS = [
  '공식',
  'official',
  '스토어',
  'store',
  '브랜드',
  '유통',
  '도매',
  '쇼핑몰',
  'mall',
];
function looksLikeSeller(c: InstagramCreator, seed: string): boolean {
  const hay = `${c.username} ${c.displayName}`.toLowerCase();
  // 계정 이름에 검색어(제품명)가 그대로 들어감 → 그 제품 파는 계정일 확률이 매우 높다.
  if (seed && seed.length >= 2 && seed.length <= 12 && hay.includes(seed)) return true;
  return SELLER_SIGNALS.some((w) => hay.includes(w));
}

/**
 * 지역 시술·방문 서비스 매장 신호 (예: 세종피부관리, 대구눈썹문신, 부천 탈모관리).
 * 이런 곳은 협업할 콘텐츠 셀럽도, 내 상품을 팔아줄 공구 셀러도 아니다 — 자기 시술을
 * 파는 '가게'다. 그래서 creator·gonggu 검색 모두에서 걸러낸다.
 */
const LOCAL_BIZ_SIGNALS = [
  // 뷰티·의료 시술 로컬샵
  '눈썹문신',
  '반영구',
  '속눈썹',
  '왁싱',
  '네일샵',
  '네일아트',
  '피부관리',
  '피부과',
  '에스테틱',
  '태닝',
  '두피',
  '탈모',
  '미용실',
  '헤어샵',
  '헤어살롱',
  '바버샵',
  '성형외과',
  '클리닉',
  '한의원',
  '치과',
  '의원',
  '병원',
  '약국',
  '의료원',
  '요양원',
  '필라테스',
  '요가원',
  '공방',
  // 예약·방문 안내(= 매장 계정의 결정적 신호)
  '예약문의',
  '예약제',
  '시술문의',
  '오시는길',
  '영업시간',
  '네이버예약',
  '카톡예약',
  '방문예약',
  '상담문의',
];

/**
 * 리테일·유통 판매 신호. creator 검색에선 "협업할 사람이 아니라 판매자"라 제외하지만,
 * gonggu(공구셀러) 검색에선 오히려 찾는 대상이므로 제외하지 않는다.
 */
const RETAIL_SIGNALS = ['셀렉트샵', '편집샵', '소품샵', '스마트스토어', '도매', '유통', '쇼핑몰'];

function hay(c: InstagramCreator): string {
  return `${c.username} ${c.displayName} ${c.biography ?? ''}`.toLowerCase();
}
/** 지역 시술·방문 매장 판별 — 셀럽 검색·공구 검색 모두에서 제외 대상. */
function looksLikeLocalBiz(c: InstagramCreator): boolean {
  const h = hay(c);
  return LOCAL_BIZ_SIGNALS.some((w) => h.includes(w));
}
/** 리테일/유통 판매 계정 판별 — creator 검색에서만 제외. */
function looksLikeRetail(c: InstagramCreator): boolean {
  const h = hay(c);
  return RETAIL_SIGNALS.some((w) => h.includes(w));
}

/**
 * 브랜드 본사·공식채널·정보성/웹사이트 계정 판별. 협업할 콘텐츠 셀럽도, 내 상품을
 * 팔아줄 공구 셀러도 아니라 '회사/채널'이다 → creator·gonggu·both 모두에서 제외.
 *  - 이름/아이디에 공식·official·브랜드
 *  - 인스타 카테고리가 Product/service·Website·Brand·News 등(개인 크리에이터는 이런 분류가 아님)
 */
const BRAND_ORG_NAME = ['공식채널', '공식계정', '공식', 'official', '브랜드'];
// 비영리·복지·공공 '단체/기관' 이름 신호 — 협업할 크리에이터도 공구 셀러도 아니다
// (예: 독거노인종합지원센터, ○○복지관, ○○협회). 카테고리가 비어도 이름으로 잡는다.
const ORG_NAME_SIGNALS = [
  '협회',
  '재단',
  '복지관',
  '복지센터',
  '지원센터',
  '진흥원',
  '진흥공단',
  '공단',
  '시민단체',
  '자원봉사',
];
const ORG_CATEGORY = [
  'product/service',
  'website',
  'e-commerce',
  'brand',
  'company',
  'news',
  'magazine',
  // 비영리·정부·지역·종교·정치 '단체' 카테고리 (Nonprofit/Community/Government/
  // Religious/Political organization) — 'organization' 하나로 대부분 걸린다.
  'organization',
  'nonprofit',
  'charity',
  'government',
];
function looksLikeBrandOrOrg(c: InstagramCreator): boolean {
  const nh = `${c.username} ${c.displayName}`.toLowerCase();
  if (BRAND_ORG_NAME.some((w) => nh.includes(w))) return true;
  if (ORG_NAME_SIGNALS.some((w) => nh.includes(w))) return true;
  const cat = (c.category ?? '').toLowerCase();
  return cat.length > 0 && ORG_CATEGORY.some((w) => cat.includes(w));
}

/**
/** 협업/공구 가치가 없는 초소형·빈 계정 최소 기준. 팔로워 37·게시물 1 같은
 *  방금 만든/버려진 계정을 걸러낸다. 값을 '아는' 경우에만 적용(모르면 통과). */
const MIN_FOLLOWERS = 500;
const MIN_POSTS = 3;
function tooSmall(c: InstagramCreator): boolean {
  if (c.followersCount != null && c.followersCount < MIN_FOLLOWERS) return true;
  if (c.postsCount != null && c.postsCount < MIN_POSTS) return true;
  return false;
}

/**
 * 목적별 결과 제외 판정 — 수집된 후보를 저장 전에 거른다.
 *  - creator/gonggu/both: 초소형·빈 계정 + 로컬 시술매장 + 브랜드본사/공식채널/정보성 제외.
 *    creator는 리테일/판매 계정도 제외(gonggu/both는 셀러가 목표라 리테일은 살림).
 *  - brand : 신생 브랜드는 팔로워가 적을 수 있어 크기·업체 필터를 적용하지 않음.
 */
function rejectForTarget(c: InstagramCreator, target: SearchTarget): boolean {
  if (target === 'brand') return false;
  if (tooSmall(c)) return true;
  if (looksLikeLocalBiz(c)) return true;
  if (looksLikeBrandOrOrg(c)) return true;
  if (target === 'creator' && looksLikeRetail(c)) return true;
  return false;
}

/** 팔로워 규모 티어 — 나노/마이크로/미들/매크로. */
function followerTier(c: InstagramCreator): number {
  const f = c.followersCount ?? 0;
  if (f < 10_000) return 0;
  if (f < 100_000) return 1;
  if (f < 500_000) return 2;
  return 3;
}

/**
 * 규모별 라운드로빈으로 n명을 고른다. 해시태그 수집은 최근 글을 올린 작은 계정으로
 * 쏠리기 쉬운데(= 결과가 전부 마이크로), 티어를 번갈아 뽑으면 있는 만큼은 골고루 섞인다.
 * 특정 티어가 비어 있으면 남은 티어가 자연히 채우므로 결과 수는 줄지 않는다.
 */
function spreadByFollowers(list: InstagramCreator[], n: number): InstagramCreator[] {
  if (n <= 0) return [];
  if (list.length <= n) return list;
  const tiers: InstagramCreator[][] = [[], [], [], []];
  for (const c of list) tiers[followerTier(c)]!.push(c);
  // 티어 안에서는 큰 계정 우선(같은 티어라면 영향력 큰 쪽을 먼저 담는다).
  for (const t of tiers) t.sort((a, b) => (b.followersCount ?? 0) - (a.followersCount ?? 0));
  const out: InstagramCreator[] = [];
  for (let i = 0; out.length < n; i++) {
    let took = false;
    for (const t of tiers) {
      if (t.length > i) {
        out.push(t[i]!);
        took = true;
        if (out.length >= n) break;
      }
    }
    if (!took) break; // 모든 티어 소진
  }
  return out;
}

export const dynamic = 'force-dynamic';
// Only reads a finished dataset + saves rows — never waits on an Apify run.
export const maxDuration = 60;

/** Matches the limit the Discover client sends (today's effective search target). */
const TARGET = 30;
/** A running campaign with no progress for this long is considered stale. */
const STALE_MS = 10 * 60 * 1000;

/** Stage → coarse progress %, derived (never stored in the DB). */
function progressFor(stage: number): number {
  if (stage <= 1) return 30;
  if (stage === 2) return 55;
  return 80;
}
function messageFor(stage: number): string {
  if (stage <= 1) return '프로필 수집 중';
  if (stage === 2) return '게시물 분석 중';
  return '상세 분석 중';
}
/** Running payload the client renders the stage tracker from. */
function runningBody(stage: number) {
  return {
    status: 'running' as const,
    stage,
    progress: progressFor(stage),
    message: messageFor(stage),
  };
}

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}
type Sb = Awaited<ReturnType<typeof getSupabase>>;

/* eslint-disable @typescript-eslint/no-explicit-any -- DB rows / Apify items are loosely typed */

function creatorToRow(c: InstagramCreator, userId: string) {
  return {
    user_id: userId,
    platform: c.platform,
    external_id: c.id,
    username: c.username,
    display_name: c.displayName,
    profile_url: c.profileUrl,
    profile_image_url: c.profileImageUrl,
    biography: c.biography,
    followers_count: c.followersCount,
    following_count: c.followingCount,
    posts_count: c.postsCount,
    is_verified: c.isVerified,
    category: c.category,
    raw_data: c.rawData,
  };
}

/** Persist creators for a campaign. Idempotent: the unique (user, campaign, creator)
 *  constraint + ignoreDuplicates make repeated/concurrent polls safe. */
async function saveCreators(
  sb: Sb,
  userId: string,
  campaignId: string,
  query: string,
  creators: InstagramCreator[],
  startRank: number,
): Promise<void> {
  if (creators.length === 0) return;

  const { error: dcError } = await sb.from('discovered_creators').upsert(
    creators.map((c) => creatorToRow(c, userId)),
    {
      onConflict: 'user_id,platform,external_id',
    },
  );
  if (dcError) console.error(`[status] discovered_creators upsert failed: ${dcError.message}`);

  const rows = creators.map((c, i) => ({
    user_id: userId,
    campaign_id: campaignId,
    creator_id: c.id,
    platform: 'instagram',
    rank: startRank + i + 1,
    search_keyword: query,
    creator_snapshot: {
      externalId: c.id,
      username: c.username,
      displayName: c.displayName,
      profileUrl: c.profileUrl,
      profileImageUrl: c.profileImageUrl,
      biography: c.biography,
      followersCount: c.followersCount,
      followingCount: c.followingCount,
      postsCount: c.postsCount,
      isVerified: c.isVerified,
      category: c.category,
      lastPostAt: c.lastPostAt ?? null,
      recentAvgLikes: c.recentAvgLikes ?? null,
      recentAvgComments: c.recentAvgComments ?? null,
    },
  }));
  const { error } = await sb
    .from('campaign_results')
    .upsert(rows, { onConflict: 'user_id,campaign_id,creator_id', ignoreDuplicates: true });
  if (error) {
    // Never mark succeeded when the snapshot didn't persist.
    throw new Error(`campaign_results 저장 실패: ${error.message}`);
  }
}

async function existingResults(
  sb: Sb,
  userId: string,
  campaignId: string,
): Promise<{ count: number; usernames: string[] }> {
  const { data } = await sb
    .from('campaign_results')
    .select('creator_id')
    .eq('user_id', userId)
    .eq('campaign_id', campaignId);
  const ids = (data ?? []).map((r: any) => r.creator_id as string);
  return { count: ids.length, usernames: ids.map((id) => id.split(':')[1] ?? id) };
}

async function markFailed(sb: Sb, campaignId: string, message: string): Promise<void> {
  await sb
    .from('campaigns')
    .update({
      status: 'failed',
      error: message,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      apify_run_id: null, // releases the running-unique lock
    })
    .eq('id', campaignId)
    .eq('status', 'running');
}

/**
 * AI matching pass — runs ONCE, right before a campaign is marked succeeded.
 *
 * Apify only casts a wide net; this is where the results actually get judged
 * against the brand so info/irrelevant accounts drop out and real fits rank up.
 *
 * Deliberately best-effort: ANY failure (no AI key, daily cap reached, bad model
 * output) leaves the raw results untouched and the search still succeeds. The
 * search must never break because AI was unavailable.
 */
async function applyAiMatch(
  sb: Sb,
  userId: string,
  campaignId: string,
  query: string,
  productId: string | null,
  target: SearchTarget,
): Promise<void> {
  try {
    const { data: rows } = await sb
      .from('campaign_results')
      .select('creator_id,creator_snapshot')
      .eq('user_id', userId)
      .eq('campaign_id', campaignId);
    if (!rows || rows.length === 0) return;

    /* eslint-disable @typescript-eslint/no-explicit-any -- stored snapshots are jsonb */
    const creators = (rows as any[])
      .map((r) => r.creator_snapshot as any)
      .filter((s) => s && typeof s.username === 'string')
      .map((s): InstagramCreator => ({
        id: s.externalId,
        platform: 'instagram',
        username: s.username,
        displayName: s.displayName ?? s.username,
        profileUrl: s.profileUrl ?? '',
        profileImageUrl: s.profileImageUrl ?? null,
        biography: s.biography ?? null,
        followersCount: s.followersCount ?? null,
        followingCount: s.followingCount ?? null,
        postsCount: s.postsCount ?? null,
        isVerified: Boolean(s.isVerified),
        category: s.category ?? null,
        lastPostAt: s.lastPostAt ?? null,
        recentAvgLikes: s.recentAvgLikes ?? null,
        recentAvgComments: s.recentAvgComments ?? null,
        rawData: null,
      }));
    /* eslint-enable @typescript-eslint/no-explicit-any */
    if (creators.length === 0) return;

    // Brand context makes the verdict "fit for THIS product" instead of just
    // "on topic". Absent product → judge against the search intent only.
    let brand: BrandContext | null = null;
    if (productId) {
      const { data: p } = await sb
        .from('products')
        .select('name,brand,category,usp,selling_points,target')
        .eq('id', productId)
        .maybeSingle();
      if (p) {
        const row = p as Record<string, string | null>;
        brand = {
          productName: row.name,
          brand: row.brand,
          category: row.category,
          usp: row.usp,
          sellingPoints: row.selling_points,
          target: row.target,
        };
      }
    }

    const verdicts = await matchCreators(userId, query, creators, brand, target);
    if (verdicts.size === 0) return;

    // Persist per creator. Sequential updates keep it simple and are cheap at
    // ~24 rows; a failure on one row must not abort the rest.
    for (const c of creators) {
      const m = verdicts.get(c.username.toLowerCase());
      if (!m) continue;
      const { error } = await sb
        .from('campaign_results')
        .update({
          ai_score: m.score,
          ai_verdict: m.verdict,
          ai_reason: m.reason,
          ai_audience: m.audience || null,
        })
        .eq('user_id', userId)
        .eq('campaign_id', campaignId)
        .eq('creator_id', c.id);
      if (error) console.error(`[status] ai verdict save failed (${c.username}): ${error.message}`);
    }
    // Judging succeeded — clear any earlier AI warning (e.g. a transient plan slip).
    await sb.from('campaigns').update({ ai_error: null }).eq('id', campaignId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[status] AI matching skipped for campaign ${campaignId}: ${msg}`);
    // Surface it: the search still succeeds, but the user learns judging was skipped.
    await sb
      .from('campaigns')
      .update({ ai_error: aiErrorMessage(err) })
      .eq('id', campaignId);
  }
}

async function markSucceeded(sb: Sb, campaignId: string, count: number): Promise<void> {
  await sb
    .from('campaigns')
    .update({
      status: 'succeeded',
      result_count: count,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      apify_run_id: null,
    })
    .eq('id', campaignId)
    .eq('status', 'running');
}

/**
 * Conditional claim — only ONE concurrent poll may advance a stage, so the next
 * Actor is started exactly once even if the Discover poller and the global
 * poller both call this at the same moment.
 */
async function claimStage(
  sb: Sb,
  campaignId: string,
  fromStage: number,
  fromRunId: string,
  toStage: number,
): Promise<boolean> {
  const { data } = await sb
    .from('campaigns')
    .update({ apify_stage: toStage, apify_run_id: null, apify_dataset_id: null })
    .eq('id', campaignId)
    .eq('status', 'running')
    .eq('apify_stage', fromStage)
    .eq('apify_run_id', fromRunId)
    .select('id');
  return Boolean(data && data.length > 0);
}

async function attachRun(
  sb: Sb,
  campaignId: string,
  run: { runId: string; datasetId: string },
): Promise<void> {
  await sb
    .from('campaigns')
    .update({ apify_run_id: run.runId, apify_dataset_id: run.datasetId })
    .eq('id', campaignId)
    .eq('status', 'running');
}

/**
 * POST /api/campaigns/:campaignId/status — advance the async search.
 *
 * POST (not GET) because this MUTATES: it collects a finished Apify dataset,
 * persists results and starts the next stage. Plain reads go straight to
 * Supabase from the client. Safe under concurrent/duplicate polling via the
 * conditional stage claim + the campaign_results unique constraint.
 */
export const POST = withErrorHandling(
  async (_request: NextRequest, { params }: { params: { campaignId: string } }) => {
    const campaignId = params.campaignId;
    if (!isSupabaseConfigured()) return ok({ status: 'unavailable' as const });

    const sb = await getSupabase();
    const { data: auth } = await sb.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return ok({ status: 'unavailable' as const });

    const { data: row } = await sb
      .from('campaigns')
      .select(
        'id,query,status,error,result_count,apify_run_id,apify_dataset_id,apify_stage,started_at,product_id,search_mode,search_target,search_plan,platform',
      )
      .eq('id', campaignId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!row) return fail('NOT_FOUND', '캠페인을 찾을 수 없습니다.', 404);

    const c = row as any;
    if (c.status !== 'running') {
      return ok({
        status: c.status,
        resultCount: c.result_count ?? 0,
        error: c.error ?? null,
        progress: c.status === 'succeeded' ? 100 : 0,
      });
    }

    const curStage: number = c.apify_stage ?? 1;
    const startedMs = c.started_at ? new Date(c.started_at).getTime() : 0;
    const stale = startedMs > 0 && Date.now() - startedMs > STALE_MS;

    // A run isn't attached yet (POST or a stage claim is starting it right now).
    if (!c.apify_run_id) {
      if (stale) {
        const msg = '검색을 시작하지 못했습니다. 다시 검색해 주세요.';
        await markFailed(sb, campaignId, msg);
        return ok({ status: 'failed' as const, error: msg });
      }
      return ok(runningBody(curStage));
    }

    const run = await getRunStatus(c.apify_run_id);
    if (!run) {
      const msg = 'Apify 실행 정보를 조회할 수 없습니다. 다시 검색해 주세요.';
      await markFailed(sb, campaignId, msg);
      return ok({ status: 'failed' as const, error: msg });
    }
    if (run.status === 'READY' || run.status === 'RUNNING' || run.status === 'ABORTING') {
      // Still running — but if it's been stuck well past the expected time, give
      // up so the campaign never sits on "검색 중" forever (the browser poller may
      // have been paused for hours). A SUCCEEDED run is handled below and always
      // collected, so this only fails runs that genuinely never finished.
      if (stale) {
        const msg = '검색이 시간 내에 완료되지 않았습니다. 다시 검색해 주세요.';
        await markFailed(sb, campaignId, msg);
        return ok({ status: 'failed' as const, error: msg });
      }
      return ok(runningBody(curStage));
    }
    if (run.status !== 'SUCCEEDED') {
      const msg = `검색이 실패했습니다. (${run.status})`;
      await markFailed(sb, campaignId, msg);
      return ok({ status: 'failed' as const, error: msg });
    }

    // ── Run SUCCEEDED → collect this stage's dataset and advance ──────────────
    const datasetId: string | null = c.apify_dataset_id ?? run.datasetId;
    if (!datasetId) {
      const msg = '검색 결과 데이터셋을 찾을 수 없습니다. 다시 검색해 주세요.';
      await markFailed(sb, campaignId, msg);
      return ok({ status: 'failed' as const, error: msg });
    }

    const stage: number = c.apify_stage ?? 1;
    const query: string = c.query;
    const mode: 'keyword' | 'tagged' = c.search_mode === 'tagged' ? 'tagged' : 'keyword';
    /** Chosen when the search started — decides which way the AI judges. */
    // gonggu(공구셀러)는 판매자처럼 보이므로 creator용 업체/판매자 필터를 타면 안 된다
    // (그 필터는 target==='creator'에서만 돌아, gonggu/brand는 자연히 제외됨).
    const target: SearchTarget =
      c.search_target === 'brand'
        ? 'brand'
        : c.search_target === 'gonggu'
          ? 'gonggu'
          : c.search_target === 'both'
            ? 'both'
            : 'creator';
    // AI's translation of a natural-language request (null for plain keywords).
    const plan = (c.search_plan ?? null) as {
      searchTerm?: string;
      hashtags?: string[];
      intent?: string;
    } | null;
    /** What the AI should judge fit against — the intent, not "…찾아줘". */
    const matchContext = plan?.intent || query;

    const platform: string = c.platform ?? 'instagram';

    try {
      const items = await readDataset(datasetId);

      // ── TikTok·YouTube — 단일 스테이지: 데이터셋 → 작성자/채널 정규화 → 저장 → 판정 → 완료 ──
      //    인스타 3단계 머신을 타지 않는다(별 분기). 플랫폼별 정규화 함수만 다르다.
      if (platform !== 'instagram') {
        let creators =
          platform === 'youtube' ? creatorsFromYoutube(items) : creatorsFromTiktok(items);
        // 목적별 제외(로컬 매장·빈 계정 등) — 틱톡·유튜브도 동일.
        creators = creators.filter((cr) => !rejectForTarget(cr, target));
        creators = spreadByFollowers(creators, TARGET);
        await saveCreators(sb, userId, campaignId, query, creators, 0);
        const { count } = await existingResults(sb, userId, campaignId);
        await applyAiMatch(sb, userId, campaignId, matchContext, c.product_id ?? null, target);
        await markSucceeded(sb, campaignId, count);
        return ok({ status: 'succeeded' as const, resultCount: count, progress: 100 });
      }

      // ── Tagged mode — the same 3-stage machine, two stages long ─────────────
      //    1 = posts tagging the brand → author usernames
      //    2 = enrich those authors → profiles → done
      if (mode === 'tagged') {
        if (stage === 1) {
          // The tagged actor returns POSTS; the value is who wrote them.
          const authors = authorsFromPosts(items, []).slice(0, stage3Cap(TARGET));
          if (authors.length === 0) {
            await markSucceeded(sb, campaignId, 0);
            return ok({ status: 'succeeded' as const, resultCount: 0, progress: 100 });
          }
          if (!(await claimStage(sb, campaignId, 1, c.apify_run_id, 2))) {
            return ok(runningBody(2));
          }
          const started = await startActorRun(stage3Input(authors));
          await attachRun(sb, campaignId, started);
          return ok(runningBody(2));
        }

        // Stage 2 — enriched profiles → save → judge → finish.
        // 태그 검색도 동일하게: 로컬 매장·빈 계정 제외 + 규모 골고루.
        const enrichedTagged = profilesFromItems(items);
        const creators = spreadByFollowers(
          enrichedTagged.filter((cr) => !rejectForTarget(cr, target)),
          TARGET,
        );
        await saveCreators(sb, userId, campaignId, query, creators, 0);
        await upsertPool('instagram', enrichedTagged);
        const { count } = await existingResults(sb, userId, campaignId);
        // Tell the AI these came from tagging a brand — that's the signal.
        await applyAiMatch(
          sb,
          userId,
          campaignId,
          `@${query} 브랜드를 태그한 계정 (브랜드 협업 경험 있음)`,
          c.product_id ?? null,
          target,
        );
        await markSucceeded(sb, campaignId, count);
        return ok({ status: 'succeeded' as const, resultCount: count, progress: 100 });
      }

      // ── Keyword mode ───────────────────────────────────────────────────────
      // Stage 1 — profile (account-name) search results.
      if (stage === 1) {
        // 자르기 전에 먼저 거른다 — 순서가 반대면 걸러질 계정이 자리를 차지해 손해다.
        const stage1All = profilesFromItems(items);
        // 셀럽 찾기: 이름 검색이 데려온 판매자/브랜드 계정을 걸러낸다. 걸러서 수가
        // 줄면 아래 "충분" 조건에 안 걸려 해시태그→작성자(진짜 크리에이터)로 넘어간다.
        const seed = (plan?.searchTerm || query).toLowerCase();
        const creators = spreadByFollowers(
          stage1All.filter(
            (cr) =>
              !rejectForTarget(cr, target) &&
              // 계정명에 제품명이 박힌 판매 계정은 셀럽 검색에서만 제외(공구는 셀러가 목표).
              !(target === 'creator' && looksLikeSeller(cr, seed)),
          ),
          TARGET,
        );
        await saveCreators(sb, userId, campaignId, query, creators, 0);
        await upsertPool('instagram', stage1All);
        const { count } = await existingResults(sb, userId, campaignId);

        // 브랜드 찾기는 stage1(계정 이름 검색)만으로 끝낸다. stage2(해시태그→작성자)는
        // '해시태그 글을 쓴 사람(=크리에이터)'을 데려와 브랜드 검색을 오염시키고, Apify
        // 실행이 하나 더 붙어 느려진다(연쇄 중 하나만 멈춰도 클라이언트 10분 타임아웃에
        // 걸려 자동 취소=실패). 브랜드 공식계정은 애초에 이름 검색에서 나온다.
        if (target === 'brand') {
          await applyAiMatch(sb, userId, campaignId, matchContext, c.product_id ?? null, target);
          await markSucceeded(sb, campaignId, count);
          return ok({ status: 'succeeded' as const, resultCount: count, progress: 100 });
        }

        if (count >= Math.min(TARGET, SEARCH_MIN_SUFFICIENT)) {
          await applyAiMatch(sb, userId, campaignId, matchContext, c.product_id ?? null, target);
          await markSucceeded(sb, campaignId, count);
          return ok({ status: 'succeeded' as const, resultCount: count, progress: 100 });
        }
        if (!(await claimStage(sb, campaignId, 1, c.apify_run_id, 2))) {
          return ok(runningBody(2)); // another poll won the claim
        }
        // AI's real hashtags when the user wrote a sentence; rule-based otherwise.
        const started = await startActorRun(stage2Input(query, plan?.hashtags));
        await attachRun(sb, campaignId, started);
        return ok(runningBody(2));
      }

      // Stage 2 — posts → author usernames → enrich.
      if (stage === 2) {
        const { count, usernames } = await existingResults(sb, userId, campaignId);
        const authors = authorsFromPosts(items, usernames);
        const toEnrich = authors.slice(0, stage3Cap(Math.max(TARGET - count, 0)));

        if (toEnrich.length === 0) {
          await applyAiMatch(sb, userId, campaignId, matchContext, c.product_id ?? null, target);
          await markSucceeded(sb, campaignId, count);
          return ok({ status: 'succeeded' as const, resultCount: count, progress: 100 });
        }

        // Reuse fresh pooled profiles (no Apify); scrape only the rest.
        // Trending searches skip the pool so 최근 활동 stays live.
        let toScrape = toEnrich;
        if (!TREND_RE.test(matchContext)) {
          const { pooled, missing } = await getPooled('instagram', toEnrich);
          // 풀에서 온 계정도 목적별 제외를 똑같이 적용.
          const cleanPooled = pooled.filter((cr) => !rejectForTarget(cr, target));
          if (cleanPooled.length > 0) {
            await saveCreators(
              sb,
              userId,
              campaignId,
              query,
              spreadByFollowers(cleanPooled, Math.max(TARGET - count, 0)),
              count,
            );
          }
          toScrape = missing;
        }

        // Everything came from the pool → judge + finish, no Apify run.
        if (toScrape.length === 0) {
          const { count: pooledCount } = await existingResults(sb, userId, campaignId);
          await applyAiMatch(sb, userId, campaignId, matchContext, c.product_id ?? null, target);
          await markSucceeded(sb, campaignId, pooledCount);
          return ok({ status: 'succeeded' as const, resultCount: pooledCount, progress: 100 });
        }

        if (!(await claimStage(sb, campaignId, 2, c.apify_run_id, 3))) {
          return ok(runningBody(3));
        }
        const started = await startActorRun(stage3Input(toScrape));
        await attachRun(sb, campaignId, started);
        return ok(runningBody(3));
      }

      // Stage 3 — enriched profile details → finish.
      const { count: before } = await existingResults(sb, userId, campaignId);
      const room = Math.max(TARGET - before, 0);
      const enriched = profilesFromItems(items);
      // 목적별 제외 후, 규모가 한쪽으로 쏠리지 않게 골고루 뽑아 저장(풀 캐시엔 원본 유지).
      const toSave = enriched.filter((cr) => !rejectForTarget(cr, target));
      await saveCreators(sb, userId, campaignId, query, spreadByFollowers(toSave, room), before);
      await upsertPool('instagram', enriched); // feed the shared cache
      const { count } = await existingResults(sb, userId, campaignId);
      await applyAiMatch(sb, userId, campaignId, matchContext, c.product_id ?? null, target);
      await markSucceeded(sb, campaignId, count);
      return ok({ status: 'succeeded' as const, resultCount: count, progress: 100 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '검색 처리 중 오류가 발생했습니다.';
      console.error(`[status] campaign ${campaignId} stage ${stage} failed: ${msg}`);
      await markFailed(sb, campaignId, msg);
      return ok({ status: 'failed' as const, error: msg });
    }
  },
);
