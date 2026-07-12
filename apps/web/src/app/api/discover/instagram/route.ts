import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { type InstagramCreator } from '@/features/search/instagram';
import { ok, withErrorHandling } from '@/lib/api/response';
import { getDiscoveryProvider, isSupabaseConfigured } from '@/lib/env';
import { runInstagramDiscovery } from '@/services/apify/instagram';

// Env is read and Apify/Supabase clients are created only per request.
export const dynamic = 'force-dynamic';
// Apify sync runs can take a while; allow more than the default budget.
export const maxDuration = 60;

const bodySchema = z.object({
  query: z.string().trim().max(100).optional(),
  hashtag: z.string().trim().max(100).optional(),
  limit: z.number().int().min(1).max(30).optional(),
  refresh: z.boolean().optional(),
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

  // Serve already-discovered creators (skip re-running) unless a refresh is asked.
  const existing =
    supabase && userId && !body.refresh ? await fetchDiscovered(supabase, userId) : [];
  if (existing.length > 0) {
    return ok({ configured: true, creators: existing });
  }

  // ── Worker mode ──────────────────────────────────────────────────────────
  // Enqueue a job for the local Playwright worker and return whatever we have
  // now (often empty on first run). No new UI: the client shows mock until the
  // worker populates `discovered_creators`.
  if (provider === 'worker') {
    if (!supabase || !userId) {
      // A job needs an owning user (RLS). Without one, stay in mock mode.
      return ok({ configured: false, creators: [] as InstagramCreator[] });
    }
    const query = (body.query ?? body.hashtag ?? '').trim();
    await enqueueDiscoveryJob(supabase, userId, query);
    const current = await fetchDiscovered(supabase, userId);
    return ok({ configured: true, queued: true, creators: current });
  }

  // ── Apify mode ─────────────────────────────────────────────────────────
  // Run the Apify actor inline (server-only token). The seed term (query, or the
  // hashtag the client sends) is passed as a USER search so we collect public
  // accounts — with full profile fields — rather than hashtag posts.
  const creators = await runInstagramDiscovery({
    query: body.query ?? body.hashtag,
    limit: body.limit,
  });

  if (supabase && userId && creators.length > 0) {
    await supabase.from('discovered_creators').upsert(
      creators.map((c) => creatorToRow(c, userId as string)),
      { onConflict: 'user_id,platform,external_id' },
    );
  }

  return ok({ configured: true, creators });
});

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
