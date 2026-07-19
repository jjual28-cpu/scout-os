import { type createClient } from '@/lib/supabase/client';

import { toLabel } from '../label';
import { type CampaignLabel, type CampaignResult, type CampaignStatus } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any -- DB rows are loosely typed */

/** The browser Supabase client (as returned by our `createClient`). */
type Sb = ReturnType<typeof createClient>;

/** Columns selected for a campaign (order matches CAMPAIGN_COLUMNS). */
export const CAMPAIGN_COLUMNS =
  'id,title,query,platform,status,error,ai_error,label,source,memo,brand,season,goal,favorite,product_id,result_count,created_at,updated_at,started_at,completed_at,apify_stage';

/** A campaign row from the DB, normalized to camelCase (no derived fields). */
export type RawCampaign = {
  id: string;
  title: string;
  query: string;
  platform: string;
  status: CampaignStatus;
  error: string | null;
  /** User-facing reason an AI step was skipped (null = AI fine or unused). */
  aiError: string | null;
  label: CampaignLabel;
  source: 'manual' | 'ai';
  memo: string | null;
  brand: string | null;
  season: string | null;
  goal: string | null;
  favorite: boolean;
  productId: string | null;
  resultCount: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  apifyStage: number | null;
};

function mapCampaign(r: any): RawCampaign {
  return {
    id: r.id,
    title: r.title ?? r.query,
    query: r.query,
    platform: r.platform ?? 'instagram',
    status: (r.status ?? 'succeeded') as CampaignStatus,
    error: r.error ?? null,
    aiError: r.ai_error ?? null,
    label: toLabel(r.label),
    source: r.source === 'ai' ? 'ai' : 'manual',
    memo: r.memo ?? null,
    brand: r.brand ?? null,
    season: r.season ?? null,
    goal: r.goal ?? null,
    favorite: Boolean(r.favorite),
    productId: r.product_id ?? null,
    resultCount: r.result_count ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? r.created_at,
    startedAt: r.started_at ?? null,
    completedAt: r.completed_at ?? null,
    apifyStage: r.apify_stage ?? null,
  };
}

/**
 * The campaign Discover should open on entry. Priority: newest running (a search
 * in flight) → newest succeeded → newest failed. Null when the user has none.
 */
export async function getLatestCampaign(sb: Sb, userId: string): Promise<RawCampaign | null> {
  const pick = async (status: string) => {
    const { data } = await sb
      .from('campaigns')
      .select(CAMPAIGN_COLUMNS)
      .eq('user_id', userId)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(1);
    const row = (data as any[] | null)?.[0];
    return row ? mapCampaign(row) : null;
  };
  return (await pick('running')) ?? (await pick('succeeded')) ?? (await pick('failed'));
}

/** All of the user's in-flight campaigns — drives the global poller. */
export async function listRunningCampaigns(sb: Sb, userId: string): Promise<RawCampaign[]> {
  const { data } = await sb
    .from('campaigns')
    .select(CAMPAIGN_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .limit(5);
  return ((data as any[] | null) ?? []).map(mapCampaign);
}

/** All of a user's campaigns, newest first. */
export async function listCampaigns(sb: Sb, userId: string): Promise<RawCampaign[]> {
  const { data } = await sb
    .from('campaigns')
    .select(CAMPAIGN_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(300);
  return (data ?? []).map(mapCampaign);
}

/** Lightweight (campaign_id, creator_id) links for funnel derivation across all campaigns. */
export async function listResultLinks(
  sb: Sb,
  userId: string,
): Promise<{ campaignId: string; creatorId: string }[]> {
  const { data } = await sb
    .from('campaign_results')
    .select('campaign_id,creator_id')
    .eq('user_id', userId);
  return (data ?? []).map((r: any) => ({ campaignId: r.campaign_id, creatorId: r.creator_id }));
}

/** One campaign by id (scoped to the user). */
export async function getCampaign(sb: Sb, userId: string, id: string): Promise<RawCampaign | null> {
  const { data } = await sb
    .from('campaigns')
    .select(CAMPAIGN_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  return data ? mapCampaign(data) : null;
}

/** A campaign's creator snapshots, ordered by rank. */
export async function listResults(
  sb: Sb,
  userId: string,
  campaignId: string,
): Promise<CampaignResult[]> {
  // AI fit first (ai_score desc), then the original discovery order. Results the
  // AI hasn't judged (null score) fall back to rank so nothing disappears.
  const { data } = await sb
    .from('campaign_results')
    .select(
      'creator_snapshot,rank,ai_score,ai_verdict,ai_reason,ai_audience,visual_score,visual_verdict,visual_reason',
    )
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .order('ai_score', { ascending: false, nullsFirst: false })
    .order('rank', { ascending: true });
  return (data ?? [])
    .map((r: any) => {
      const snap = r.creator_snapshot as CampaignResult;
      if (!snap) return snap;
      return {
        ...snap,
        aiScore: r.ai_score ?? null,
        aiVerdict: r.ai_verdict ?? null,
        aiReason: r.ai_reason ?? null,
        aiAudience: r.ai_audience ?? null,
        visualScore: r.visual_score ?? null,
        visualVerdict: r.visual_verdict ?? null,
        visualReason: r.visual_reason ?? null,
      } satisfies CampaignResult;
    })
    .filter((r) => r && r.externalId);
}

/** Editable campaign fields. */
export type CampaignPatch = Partial<{
  title: string;
  memo: string | null;
  brand: string | null;
  season: string | null;
  goal: string | null;
  label: CampaignLabel;
  favorite: boolean;
  productId: string | null;
}>;

/** Update a campaign's editable fields (always bumps updated_at). */
export async function updateCampaign(sb: Sb, id: string, patch: CampaignPatch): Promise<void> {
  const row: Record<string, any> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.memo !== undefined) row.memo = patch.memo;
  if (patch.brand !== undefined) row.brand = patch.brand;
  if (patch.season !== undefined) row.season = patch.season;
  if (patch.goal !== undefined) row.goal = patch.goal;
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.favorite !== undefined) row.favorite = patch.favorite;
  if (patch.productId !== undefined) row.product_id = patch.productId;
  const { error } = await sb.from('campaigns').update(row).eq('id', id);
  if (error) throw error;
}

/** Delete a campaign; campaign_results cascade. discovered_creators / saved /
 *  outreach / dm_drafts are NOT touched (no FK to campaigns). */
export async function deleteCampaign(sb: Sb, id: string): Promise<void> {
  const { error } = await sb.from('campaigns').delete().eq('id', id);
  if (error) throw error;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
