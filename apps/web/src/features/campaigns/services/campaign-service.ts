import { type createClient } from '@/lib/supabase/client';

import { toLabel } from '../label';
import { type CampaignLabel, type CampaignResult, type CampaignStatus } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any -- DB rows are loosely typed */

/** The browser Supabase client (as returned by our `createClient`). */
type Sb = ReturnType<typeof createClient>;

/** Columns selected for a campaign (order matches CAMPAIGN_COLUMNS). */
export const CAMPAIGN_COLUMNS =
  'id,title,query,platform,status,error,label,source,memo,brand,season,goal,favorite,product_id,result_count,created_at,updated_at';

/** A campaign row from the DB, normalized to camelCase (no derived fields). */
export type RawCampaign = {
  id: string;
  title: string;
  query: string;
  platform: string;
  status: CampaignStatus;
  error: string | null;
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
};

function mapCampaign(r: any): RawCampaign {
  return {
    id: r.id,
    title: r.title ?? r.query,
    query: r.query,
    platform: r.platform ?? 'instagram',
    status: (r.status ?? 'succeeded') as CampaignStatus,
    error: r.error ?? null,
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
  };
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
  const { data } = await sb
    .from('campaign_results')
    .select('creator_snapshot,rank')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .order('rank', { ascending: true });
  return (data ?? [])
    .map((r: any) => r.creator_snapshot as CampaignResult)
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
