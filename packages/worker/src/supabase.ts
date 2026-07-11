import { createClient } from '@supabase/supabase-js';

import { config } from './config.js';
import type { DiscoveryJob, NormalizedCreator } from './types.js';

/** Service-role client — bypasses RLS so the worker can process any pending job. */
export const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Atomically claim the oldest pending job: read it, then flip pending → running
 * guarded by `.eq('status','pending')` so a concurrent worker can't double-claim.
 * Returns null if there's nothing to do (or another worker won the race).
 */
export async function claimNextJob(): Promise<DiscoveryJob | null> {
  const { data: pending, error } = await supabase
    .from('discovery_jobs')
    .select('id,user_id,platform,provider,query,status,attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw error;

  const job = pending?.[0] as DiscoveryJob | undefined;
  if (!job) return null;

  const { data: claimed } = await supabase
    .from('discovery_jobs')
    .update({ status: 'running', started_at: new Date().toISOString(), attempts: job.attempts + 1 })
    .eq('id', job.id)
    .eq('status', 'pending')
    .select('id,user_id,platform,provider,query,status,attempts');

  return (claimed?.[0] as DiscoveryJob | undefined) ?? null;
}

export async function completeJob(id: string, resultCount: number): Promise<void> {
  await supabase
    .from('discovery_jobs')
    .update({
      status: 'succeeded',
      result_count: resultCount,
      finished_at: new Date().toISOString(),
    })
    .eq('id', id);
}

export async function failJob(job: DiscoveryJob, reason: string): Promise<void> {
  // Retry (back to pending) until attempts exhausted, then mark failed with the cause.
  const exhausted = job.attempts >= config.maxAttempts;
  await supabase
    .from('discovery_jobs')
    .update({
      status: exhausted ? 'failed' : 'pending',
      error: reason,
      finished_at: exhausted ? new Date().toISOString() : null,
    })
    .eq('id', job.id);
}

/** Upsert normalized creators for a user (keeps raw_data for later AI analysis). */
export async function upsertCreators(userId: string, creators: NormalizedCreator[]): Promise<void> {
  if (creators.length === 0) return;
  const rows = creators.map((c) => ({
    user_id: userId,
    platform: c.platform,
    external_id: c.externalId,
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
  }));
  const { error } = await supabase
    .from('discovered_creators')
    .upsert(rows, { onConflict: 'user_id,platform,external_id' });
  if (error) throw error;
}
