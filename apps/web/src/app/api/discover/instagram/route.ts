import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { type InstagramCreator } from '@/features/search/instagram';
import { ok, withErrorHandling } from '@/lib/api/response';
import { isApifyConfigured, isSupabaseConfigured } from '@/lib/env';
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
 * POST /api/discover/instagram — real Instagram creator discovery via Apify.
 *
 * - Apify not configured → { configured: false } so the client keeps mock mode.
 * - Signed-in user's previously discovered creators are served from Supabase to
 *   avoid re-running the actor on every visit; pass `refresh: true` to re-fetch.
 * - Fresh results are upserted into `discovered_creators` for the user.
 * The APIFY_API_TOKEN is used only here (server); the browser never calls Apify.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isApifyConfigured()) {
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

  // Serve already-discovered creators (skip the actor) unless a refresh is asked.
  if (supabase && userId && !body.refresh) {
    const { data: rows } = await supabase
      .from('discovered_creators')
      .select(
        'external_id,username,display_name,profile_url,profile_image_url,biography,followers_count,following_count,posts_count,is_verified,category,raw_data',
      )
      .eq('platform', 'instagram')
      .order('created_at', { ascending: false })
      .limit(30);
    if (rows && rows.length > 0) {
      return ok({ configured: true, creators: rows.map(rowToCreator) });
    }
  }

  const creators = await runInstagramDiscovery({
    query: body.query,
    hashtag: body.hashtag,
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

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}
