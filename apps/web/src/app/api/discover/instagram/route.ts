import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { type InstagramCreator } from '@/features/search/instagram';
import { ok, withErrorHandling } from '@/lib/api/response';
import { getDiscoveryProvider, isSupabaseConfigured } from '@/lib/env';
import { runInstagramDiscovery } from '@/services/apify/instagram';

// Env is read and Apify/Supabase clients are created only per request.
export const dynamic = 'force-dynamic';
// A topic search may run up to 3 sequential Apify passes (user → posts → details),
// so allow a larger budget (Vercel caps this to the plan's max at runtime).
export const maxDuration = 300;

const bodySchema = z.object({
  query: z.string().trim().max(100).optional(),
  hashtag: z.string().trim().max(100).optional(),
  limit: z.number().int().min(1).max(30).optional(),
  refresh: z.boolean().optional(),
  /** Campaign metadata carried from 다시 검색 / 복제 / (future) AI Engine. All nullable. */
  productId: z.string().uuid().optional(),
  title: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(120).optional(),
  season: z.string().trim().max(60).optional(),
  goal: z.string().trim().max(120).optional(),
  memo: z.string().trim().max(2000).optional(),
  label: z.enum(['active', 'hold', 'done', 'failed']).optional(),
  source: z.enum(['manual', 'ai']).optional(),
});

/* eslint-disable @typescript-eslint/no-explicit-any -- DB rows are loosely typed here */
function creatorToRow(c: InstagramCreator, userId: string) {
  return {
    user_id: userId,
    platform: 'instagram',
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
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * POST /api/discover/instagram — real Instagram creator discovery.
 *
 * The source is selected by DISCOVERY_PROVIDER (see `getDiscoveryProvider`):
 *  - 'worker': serve the user's `discovered_creators` from Supabase and enqueue a
 *    `discovery_jobs` row that the local Playwright worker (packages/worker) picks
 *    up. The worker fills the table asynchronously; the next visit shows results.
 *  - 'apify': run the Apify actor inline (server-only APIFY_API_TOKEN).
 *  - 'mock' (or unconfigured): { configured: false } so the client keeps mock mode.
 * The browser never calls Apify or the worker directly.
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
  // Serve already-discovered creators (DB-first), else enqueue a job the local
  // Playwright worker picks up to fill `discovered_creators` asynchronously.
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

  // ── Apify mode (keyword search → Campaign) ───────────────────────────────
  // Each search is a CAMPAIGN: create it (status 'running'), run Apify, upsert
  // `discovered_creators`, snapshot all results into `campaign_results`, then
  // complete the campaign (or mark it failed). Returns the campaign's id.
  const query = (body.query ?? body.hashtag ?? '').trim();
  if (!query) {
    return ok({ configured: true, creators: [] as InstagramCreator[] });
  }

  let campaignId: string | null = null;
  if (supabase && userId) {
    campaignId = await createCampaign(supabase, userId, query, {
      title: body.title?.trim() || query,
      productId: body.productId ?? null,
      brand: body.brand ?? null,
      season: body.season ?? null,
      goal: body.goal ?? null,
      memo: body.memo ?? null,
      label: body.label ?? 'active',
      source: body.source ?? 'manual',
    });
  }

  let creators: InstagramCreator[];
  try {
    creators = await runInstagramDiscovery({ query, limit: body.limit ?? 24 });
  } catch (err) {
    if (supabase && userId && campaignId) {
      const message = err instanceof Error ? err.message : 'search_failed';
      await updateCampaign(supabase, campaignId, {
        status: 'failed',
        error: message,
        result_count: 0,
      });
    }
    throw err;
  }

  // `resultsSaved` tells the client whether the campaign_results snapshot persisted.
  // A campaign is only marked 'succeeded' (with a result_count) when its snapshot saved.
  let resultsSaved = true;
  if (supabase && userId) {
    if (creators.length > 0) {
      const { error: dcError } = await supabase.from('discovered_creators').upsert(
        creators.map((c) => creatorToRow(c, userId as string)),
        { onConflict: 'user_id,platform,external_id' },
      );
      if (dcError) {
        console.error(`[discover] discovered_creators upsert failed: ${formatDbError(dcError)}`);
      }
    }
    if (campaignId) {
      const saveError = await saveResults(supabase, userId, campaignId, query, creators);
      if (saveError) {
        // Snapshot save FAILED → surface the real PostgREST error, keep the campaign
        // out of 'succeeded', and do NOT record a result_count (only saved on success).
        console.error(
          `[discover] campaign_results insert failed (campaign ${campaignId}): ${formatDbError(saveError)}`,
        );
        await updateCampaign(supabase, campaignId, {
          status: 'failed',
          error: `검색 결과 저장 실패: ${saveError.message}`,
        });
        resultsSaved = false;
      } else {
        await updateCampaign(supabase, campaignId, {
          status: 'succeeded',
          result_count: creators.length,
        });
      }
    }
  }

  return ok({ configured: true, creators, campaignId, resultsSaved });
});

type CampaignMetaInput = {
  title: string;
  productId: string | null;
  brand: string | null;
  season: string | null;
  goal: string | null;
  memo: string | null;
  label: string;
  source: string;
};

/** Create a Campaign (status 'running'); returns its id or null on failure. */
async function createCampaign(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  userId: string,
  query: string,
  meta: CampaignMetaInput,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        user_id: userId,
        query,
        title: meta.title,
        platform: 'instagram',
        status: 'running',
        result_count: 0,
        product_id: meta.productId,
        brand: meta.brand,
        season: meta.season,
        goal: meta.goal,
        memo: meta.memo,
        label: meta.label,
        source: meta.source,
      })
      .select('id')
      .single();
    if (error) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
async function updateCampaign(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  campaignId: string,
  patch: Record<string, any>,
): Promise<void> {
  try {
    await supabase
      .from('campaigns')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', campaignId);
  } catch {
    /* best-effort */
  }
}

/** A DB error shape (PostgREST/Supabase). */
type DbError = {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

/** Compact one-line rendering of a DB error for server logs. */
function formatDbError(err: DbError): string {
  return (
    err.message +
    (err.code ? ` [${err.code}]` : '') +
    (err.details ? ` — ${err.details}` : '') +
    (err.hint ? ` (hint: ${err.hint})` : '')
  );
}

/**
 * Snapshot the campaign's results into `campaign_results` (dedup by unique key).
 * Returns the PostgREST error on failure (null on success). Zero creators is a
 * success (nothing to save) — the caller then marks the campaign succeeded.
 */
async function saveResults(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  userId: string,
  campaignId: string,
  query: string,
  creators: InstagramCreator[],
): Promise<DbError | null> {
  if (creators.length === 0) return null;
  const rows = creators.map((c, i) => ({
    user_id: userId,
    campaign_id: campaignId,
    creator_id: c.id,
    platform: 'instagram',
    rank: i + 1,
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
    },
  }));
  try {
    const { error } = await supabase
      .from('campaign_results')
      .upsert(rows, { onConflict: 'user_id,campaign_id,creator_id', ignoreDuplicates: true });
    return error ?? null;
  } catch (err) {
    // Unexpected throw (network, etc.) — surface it like a DB error.
    return { message: err instanceof Error ? err.message : 'unknown error saving results' };
  }
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
