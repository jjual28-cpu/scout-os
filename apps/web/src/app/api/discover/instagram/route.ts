import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { type InstagramCreator } from '@/features/search/instagram';
import { ok, withErrorHandling } from '@/lib/api/response';
import { getDiscoveryProvider, isSupabaseConfigured } from '@/lib/env';
import { normalizeQuery } from '@/lib/normalize-query';
import { PLANS, toPlanKey } from '@/features/billing/plans';
import { aiErrorMessage } from '@/services/ai/errors';
import { type BrandContext, type SearchTarget } from '@/services/ai/match';
import { looksNatural, planSearch, type SearchPlan } from '@/services/ai/query';
import {
  normalizeHandle,
  stage1Input,
  startActorRun,
  taggedActor,
  taggedInput,
} from '@/services/apify/instagram';
import { tiktokActorId, tiktokInput } from '@/services/apify/tiktok';
import { youtubeActorId, youtubeInput } from '@/services/apify/youtube';

// Env is read and Apify/Supabase clients are created only per request.
export const dynamic = 'force-dynamic';
// Starts an Apify run and returns — it never waits for the scrape to finish.
export const maxDuration = 60;

const PLATFORM = 'instagram';
/** Matches the Discover client's limit (today's effective search target). */
const DEFAULT_LIMIT = 24;
const CACHE_WINDOW_MS = 24 * 60 * 60 * 1000;

const bodySchema = z.object({
  query: z.string().trim().max(100).optional(),
  hashtag: z.string().trim().max(100).optional(),
  /** 여러 키워드로 한 번에 — 그 키워드들의 해시태그를 모두 훑어 수집 다양성↑. */
  keywords: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
  limit: z.number().int().min(1).max(30).optional(),
  refresh: z.boolean().optional(),
  /** 최신 결과로 재검색 — ignore the 24h cache and start a new run. */
  force: z.boolean().optional(),
  /** Campaign metadata carried from 다시 검색 / 복제 / (future) AI Engine. All nullable. */
  productId: z.string().uuid().optional(),
  title: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(120).optional(),
  season: z.string().trim().max(60).optional(),
  goal: z.string().trim().max(120).optional(),
  memo: z.string().trim().max(2000).optional(),
  label: z.enum(['active', 'hold', 'done', 'failed']).optional(),
  source: z.enum(['manual', 'ai']).optional(),
  /** 'keyword' — 이름/해시태그 검색. 'tagged' — 이 브랜드를 태그한 계정 찾기. */
  mode: z.enum(['keyword', 'tagged']).optional(),
  /** 'creator' — 협업할 셀럽. 'brand' — 제품 파는 브랜드 공식 계정. */
  target: z.enum(['creator', 'brand', 'gonggu']).optional(),
  /** 검색 플랫폼. tiktok·youtube 는 단일 스테이지(키워드→작성자/채널)로 처리된다. */
  platform: z.enum(['instagram', 'tiktok', 'youtube']).optional(),
});

/* eslint-disable @typescript-eslint/no-explicit-any -- DB rows are loosely typed here */

function rowToCreator(r: any): InstagramCreator {
  return {
    id: r.external_id,
    platform: 'instagram',
    username: r.username,
    displayName: r.display_name ?? r.username,
    profileUrl: r.profile_url,
    profileImageUrl: r.profile_image_url ?? null,
    biography: r.biography ?? null,
    followersCount: r.followers_count ?? null,
    followingCount: r.following_count ?? null,
    postsCount: r.posts_count ?? null,
    isVerified: Boolean(r.is_verified),
    category: r.category ?? null,
    rawData: r.raw_data,
  };
}

/**
 * POST /api/discover/instagram — start a creator search.
 *
 * Apify mode is ASYNCHRONOUS: it creates a `running` Campaign, kicks off the
 * Stage-1 Actor run and returns the campaignId within ~1s. The scrape then
 * advances via POST /api/campaigns/:id/status (Discover + global poller), so
 * the user never waits and can navigate freely.
 *
 * Cost guards, in order: reuse a same-query `running` campaign → reuse a
 * ≤24h succeeded campaign (unless `force`) → only then start a new Actor run.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const provider = getDiscoveryProvider();
  if (provider === 'mock') {
    return ok({ configured: false, creators: [] as InstagramCreator[] });
  }

  const body = bodySchema.parse(await request.json().catch(() => ({})));

  // Per-user persistence only when Supabase is configured + the user is signed in.
  let supabase: Awaited<ReturnType<typeof getSupabase>> | null = null;
  let userId: string | null = null;
  if (isSupabaseConfigured()) {
    supabase = await getSupabase();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  }

  // ── Worker mode ──────────────────────────────────────────────────────────
  if (provider === 'worker') {
    const existing =
      supabase && userId && !body.refresh ? await fetchDiscovered(supabase, userId) : [];
    if (existing.length > 0) {
      return ok({ configured: true, creators: existing });
    }
    if (!supabase || !userId) {
      return ok({ configured: false, creators: [] as InstagramCreator[] });
    }
    const q = (body.query ?? body.hashtag ?? '').trim();
    await enqueueDiscoveryJob(supabase, userId, q);
    const current = await fetchDiscovered(supabase, userId);
    return ok({ configured: true, queued: true, creators: current });
  }

  // ── Apify mode (async Campaign search) ───────────────────────────────────
  const mode = body.mode ?? 'keyword';
  // "이 브랜드를 태그한 계정"은 본질적으로 크리에이터 찾기다 — 브랜드가 경쟁사를
  // 태그하는 일은 거의 없어서 tagged+brand 는 켜봐야 빈 결과다.
  const target: SearchTarget = mode === 'tagged' ? 'creator' : (body.target ?? 'creator');
  // 검색 플랫폼. tiktok·youtube 는 단일 스테이지(키워드→작성자/채널)로 처리된다(태그 모드 없음).
  const platform: 'instagram' | 'tiktok' | 'youtube' =
    body.platform === 'tiktok' ? 'tiktok' : body.platform === 'youtube' ? 'youtube' : 'instagram';
  // 여러 키워드: 그 키워드들을 stage 2 해시태그로 삼아 한 검색에서 모두 훑는다.
  const multiKeywords =
    mode === 'keyword'
      ? (body.keywords ?? [])
          .map((k) => k.trim())
          .filter(Boolean)
          .slice(0, 6)
      : [];
  const isMulti = multiKeywords.length > 1;
  let rawQuery = isMulti ? multiKeywords.join(', ') : (body.query ?? body.hashtag ?? '').trim();

  // In tagged mode the query IS the brand handle — normalise it up front so the
  // campaign, the cache key and the actor input all agree on one form.
  if (mode === 'tagged') {
    const handle = normalizeHandle(rawQuery);
    if (!handle) {
      return ok({
        configured: true,
        campaignId: null,
        status: 'failed' as const,
        error: '올바른 인스타그램 계정을 입력해 주세요. (예: @brandname)',
      });
    }
    rawQuery = handle;
  }

  if (!rawQuery) {
    return ok({ configured: true, campaignId: null, status: 'idle' as const });
  }

  // A Campaign is the unit of a search — without a signed-in user there's nothing
  // to persist to, so fall back to mock mode (never mixed with real data).
  if (!supabase || !userId) {
    return ok({ configured: false, creators: [] as InstagramCreator[] });
  }

  const qNorm = normalizeQuery(rawQuery);

  // 1) Same-query run already in flight → reuse it, never start a second Actor.
  const running = await findRunning(supabase, userId, qNorm, target, mode, platform);
  if (running) {
    return ok({
      configured: true,
      campaignId: running,
      status: 'running' as const,
      reusedRunning: true,
    });
  }

  // 2) 24h cache — reuse a succeeded campaign that actually has results.
  if (!body.force) {
    const cached = await findCached(supabase, userId, qNorm, target, mode, platform);
    if (cached) {
      return ok({
        configured: true,
        campaignId: cached,
        status: 'succeeded' as const,
        cached: true,
      });
    }
  }

  // 2.5) Plan limit — a NEW search costs Apify, so enforce the monthly cap here
  //      (cache reuse above is free and never counts). Free = 1/month.
  const gate = await checkSearchLimit(supabase, userId);
  if (!gate.allowed) {
    return ok({
      configured: true,
      campaignId: null,
      status: 'failed' as const,
      error: `${gate.planName} 플랜은 이번 달 검색 ${gate.limit}회를 모두 사용했어요. 설정에서 업그레이드하면 더 검색할 수 있어요.`,
    });
  }

  // 3) Create the running Campaign (query stored as the user typed it).
  const created = await createCampaign(supabase, userId, rawQuery, {
    title:
      body.title?.trim() ||
      (mode === 'tagged'
        ? `@${rawQuery} 태그`
        : target === 'brand'
          ? `${rawQuery} (브랜드)`
          : target === 'gonggu'
            ? `${rawQuery} (공구셀러)`
            : rawQuery),
    productId: body.productId ?? null,
    brand: body.brand ?? null,
    season: body.season ?? null,
    goal: body.goal ?? null,
    memo: body.memo ?? null,
    label: body.label ?? 'active',
    source: body.source ?? 'manual',
    mode,
    target,
    platform,
  });
  if (!created) {
    return ok({
      configured: true,
      campaignId: null,
      status: 'failed' as const,
      error: '검색을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    });
  }
  // Lost the insert race → another request already owns this running search.
  if (created.reused) {
    return ok({
      configured: true,
      campaignId: created.id,
      status: 'running' as const,
      reusedRunning: true,
    });
  }

  // 4) Kick off Stage 1 and return immediately.
  //    keyword → profile search on the query (AI-translated when it's a sentence).
  //    tagged  → posts tagging that brand (a different actor, same run API).
  try {
    // "신생 바디케어 브랜드 찾아줘" → Instagram understands none of that. Translate
    // first; a plain keyword ("골프") skips the AI entirely (no cost, no latency).
    let plan: SearchPlan | null = null;
    // 여러 키워드: AI 번역 없이 그 키워드들을 바로 stage2 해시태그로. (stage1 이름검색은
    // 첫 키워드로, stage2에서 모든 키워드 해시태그 게시물 작성자를 모은다.)
    if (isMulti) {
      plan = {
        searchTerm: multiKeywords[0]!,
        hashtags: multiKeywords.map((k) => k.replace(/[#\s]+/g, '')).filter(Boolean),
        intent: multiKeywords.join(', '),
      };
      await supabase
        .from('campaigns')
        .update({ search_plan: plan })
        .eq('id', created.id)
        .eq('status', 'running');
    } else if (platform === 'instagram' && mode === 'keyword' && looksNatural(rawQuery)) {
      try {
        plan = await planSearch(
          userId,
          rawQuery,
          await brandFor(supabase, body.productId ?? null),
          target,
        );
        if (plan) {
          await supabase
            .from('campaigns')
            .update({ search_plan: plan })
            .eq('id', created.id)
            .eq('status', 'running');
        }
      } catch (err) {
        // AI translation failed — don't fail the search, but record WHY so the
        // user sees it. We fall back to the raw query (previous behaviour).
        console.error(`[discover] planSearch failed (campaign ${created.id}): ${String(err)}`);
        await supabase
          .from('campaigns')
          .update({ ai_error: aiErrorMessage(err) })
          .eq('id', created.id)
          .eq('status', 'running');
      }
    }

    const started =
      mode === 'tagged'
        ? await startActorRun(taggedInput([rawQuery]), taggedActor())
        : platform === 'tiktok'
          ? await startActorRun(
              tiktokInput(isMulti ? multiKeywords : [rawQuery], body.limit ?? DEFAULT_LIMIT),
              tiktokActorId(),
            )
          : platform === 'youtube'
            ? await startActorRun(
                youtubeInput(isMulti ? multiKeywords : [rawQuery], body.limit ?? DEFAULT_LIMIT),
                youtubeActorId(),
              )
            : await startActorRun(
                stage1Input(plan?.searchTerm || rawQuery, body.limit ?? DEFAULT_LIMIT),
              );
    await supabase
      .from('campaigns')
      .update({
        apify_run_id: started.runId,
        apify_dataset_id: started.datasetId,
        apify_stage: 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', created.id)
      .eq('status', 'running');
  } catch (err) {
    // Never leave a Campaign stuck 'running' — release the lock and surface why.
    const message = err instanceof Error ? err.message : '검색을 시작하지 못했습니다.';
    console.error(`[discover] Apify run start failed (campaign ${created.id}): ${message}`);
    await supabase
      .from('campaigns')
      .update({
        status: 'failed',
        error: message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        apify_run_id: null,
      })
      .eq('id', created.id)
      .eq('status', 'running');
    return ok({
      configured: true,
      campaignId: created.id,
      status: 'failed' as const,
      error: message,
    });
  }

  return ok({
    configured: true,
    campaignId: created.id,
    status: 'running' as const,
    cached: false,
  });
});

/** Product context so the AI plans terms around what the brand actually sells. */
async function brandFor(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  productId: string | null,
): Promise<BrandContext | null> {
  if (!productId) return null;
  const { data } = await supabase
    .from('products')
    .select('name,category,target')
    .eq('id', productId)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, string | null>;
  return { productName: row.name, category: row.category, target: row.target };
}

/** This month's search count vs the user's plan limit (free = 1/month). */
async function checkSearchLimit(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  userId: string,
): Promise<{ allowed: boolean; planName: string; limit: number }> {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle();
  const plan = PLANS[toPlanKey((sub as { plan?: string } | null)?.plan)];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', monthStart);
  return {
    allowed: (count ?? 0) < plan.monthlySearches,
    planName: plan.name,
    limit: plan.monthlySearches,
  };
}

/**
 * A same-user/platform/query campaign that is still running → its id.
 *
 * target/mode are part of the key: the same word searched for brands is a
 * different search from the same word searched for creators, and reusing one
 * for the other returns exactly what the user didn't ask for.
 */
async function findRunning(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  userId: string,
  qNorm: string,
  target: SearchTarget,
  mode: 'keyword' | 'tagged',
  platform: string = PLATFORM,
): Promise<string | null> {
  const { data } = await supabase
    .from('campaigns')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('query_norm', qNorm)
    .eq('search_target', target)
    .eq('search_mode', mode)
    .eq('status', 'running')
    .limit(1);
  return (data as any[] | null)?.[0]?.id ?? null;
}

/** A ≤24h succeeded campaign for the same query that really has results → its id. */
async function findCached(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  userId: string,
  qNorm: string,
  target: SearchTarget,
  mode: 'keyword' | 'tagged',
  platform: string = PLATFORM,
): Promise<string | null> {
  const since = new Date(Date.now() - CACHE_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from('campaigns')
    .select('id,created_at,completed_at')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('query_norm', qNorm)
    .eq('search_target', target)
    .eq('search_mode', mode)
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false })
    .limit(5);

  for (const row of (data as any[] | null) ?? []) {
    const at = row.completed_at ?? row.created_at;
    if (!at || at < since) continue;
    // result_count alone isn't trusted — the snapshots must actually exist.
    const { count } = await supabase
      .from('campaign_results')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('campaign_id', row.id);
    if ((count ?? 0) > 0) return row.id as string;
  }
  return null;
}

type CampaignMetaInput = {
  title: string;
  productId: string | null;
  brand: string | null;
  season: string | null;
  goal: string | null;
  memo: string | null;
  label: string;
  source: string;
  /** How the state machine should interpret this campaign's stages. */
  mode: 'keyword' | 'tagged';
  /** What the user is hunting — flips the AI's verdict on every candidate. */
  target: SearchTarget;
  /** 검색 플랫폼 (instagram | tiktok). */
  platform: string;
};

/**
 * Create a `running` Campaign. `query` keeps the user's raw input; the DB's
 * generated `query_norm` is what the unique index and lookups compare on.
 * A unique violation means a concurrent request won — we return that campaign
 * instead of starting another Actor.
 */
async function createCampaign(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  userId: string,
  query: string,
  meta: CampaignMetaInput,
): Promise<{ id: string; reused: boolean } | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      user_id: userId,
      query,
      title: meta.title,
      platform: meta.platform,
      status: 'running',
      result_count: 0,
      product_id: meta.productId,
      brand: meta.brand,
      season: meta.season,
      goal: meta.goal,
      memo: meta.memo,
      label: meta.label,
      source: meta.source,
      search_mode: meta.mode,
      search_target: meta.target,
      started_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (!error) return { id: (data as { id: string }).id, reused: false };

  // 23505 = unique_violation → campaigns_one_running_uniq caught a duplicate.
  if ((error as any).code === '23505') {
    const existing = await findRunning(
      supabase,
      userId,
      normalizeQuery(query),
      meta.target,
      meta.mode,
      meta.platform,
    );
    if (existing) return { id: existing, reused: true };
  }
  console.error(`[discover] campaign insert failed: ${error.message}`);
  return null;
}

/** Read a user's previously discovered Instagram creators (newest first). */
async function fetchDiscovered(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  userId: string,
): Promise<InstagramCreator[]> {
  const { data: rows } = await supabase
    .from('discovered_creators')
    .select(
      'external_id,username,display_name,profile_url,profile_image_url,biography,followers_count,following_count,posts_count,is_verified,category,raw_data',
    )
    .eq('user_id', userId)
    .eq('platform', 'instagram')
    .order('created_at', { ascending: false })
    .limit(30);
  return (rows ?? []).map(rowToCreator);
}

/**
 * Enqueue a pending discovery job for the local worker, unless an identical
 * pending/running job already exists (avoids piling up duplicates on revisits).
 */
async function enqueueDiscoveryJob(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  userId: string,
  query: string,
): Promise<void> {
  const { data: active } = await supabase
    .from('discovery_jobs')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', 'instagram')
    .eq('query', query)
    .in('status', ['pending', 'running'])
    .limit(1);
  if (active && active.length > 0) return;

  await supabase.from('discovery_jobs').insert({
    user_id: userId,
    platform: 'instagram',
    provider: 'playwright',
    query,
    status: 'pending',
  });
}

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}
