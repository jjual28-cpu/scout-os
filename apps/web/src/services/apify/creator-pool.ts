import 'server-only';

import { type InstagramCreator } from '@/features/search/instagram';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Global creator pool — a shared cache of enriched Instagram profiles so a
 * creator scraped by one search isn't scraped again by the next (Apify costs
 * money per profile). Cross-user because IG profiles are public.
 *
 * Every function here is BEST-EFFORT: in mock mode createAdminClient throws,
 * and any pool failure must degrade to "scrape it" rather than break search.
 */

/** How long a pooled profile is trusted. Short, because recency (최근 게시일)
 *  drifts — trending searches bypass the pool entirely (see status route). */
const FRESH_MS = 3 * 24 * 60 * 60 * 1000;

/* eslint-disable @typescript-eslint/no-explicit-any -- jsonb snapshots are loose */

/**
 * Split usernames into fresh pooled profiles (reuse, no Apify) and the rest
 * (must be scraped). Order/casing of `usernames` is preserved in `missing`.
 */
export async function getPooled(
  platform: string,
  usernames: string[],
): Promise<{ pooled: InstagramCreator[]; missing: string[] }> {
  const uniq = [...new Set(usernames.map((u) => u.toLowerCase()))];
  if (uniq.length === 0) return { pooled: [], missing: [] };

  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - FRESH_MS).toISOString();
    const { data } = await admin
      .from('creator_pool')
      .select('username,snapshot')
      .eq('platform', platform)
      .in('username', uniq)
      .gte('scraped_at', since);

    const fresh = new Map<string, InstagramCreator>();
    for (const r of (data as any[] | null) ?? []) {
      const snap = r.snapshot as InstagramCreator;
      if (snap && typeof snap.username === 'string')
        fresh.set(String(r.username).toLowerCase(), snap);
    }

    const pooled: InstagramCreator[] = [];
    const missing: string[] = [];
    const seen = new Set<string>();
    for (const u of usernames) {
      const k = u.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      const hit = fresh.get(k);
      if (hit) pooled.push(hit);
      else missing.push(u);
    }
    return { pooled, missing };
  } catch {
    // No pool (mock / misconfigured / error) → scrape everything.
    return { pooled: [], missing: usernames };
  }
}

/** Upsert freshly-scraped profiles into the pool. Never throws. */
export async function upsertPool(platform: string, creators: InstagramCreator[]): Promise<void> {
  const rows = creators
    .filter((c) => c.username)
    .map((c) => ({
      platform,
      username: c.username.toLowerCase(),
      snapshot: { ...c, rawData: null }, // drop bulky rawData from the cache
      followers_count: c.followersCount ?? null,
      scraped_at: new Date().toISOString(),
    }));
  if (rows.length === 0) return;
  try {
    const admin = createAdminClient();
    await admin.from('creator_pool').upsert(rows, { onConflict: 'platform,username' });
  } catch {
    // best-effort — a missed cache write just means the next search re-scrapes.
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */
