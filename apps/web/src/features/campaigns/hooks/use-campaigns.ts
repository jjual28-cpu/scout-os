'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useOutreach } from '@/features/search/hooks/use-outreach';
import { useSavedOpportunities } from '@/features/search/hooks/use-saved-opportunities';
import { useProducts } from '@/features/products';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

import * as svc from '../services/campaign-service';
import { computeSummary, computeLastAction } from '../summary';
import { type Campaign, type CampaignLabel } from '../types';

/**
 * All of the signed-in user's campaigns, each with a funnel summary + last-action
 * chip DERIVED by joining campaign_results with saved_opportunities + outreach.
 * Favourites are pinned to the top. Empty in mock mode / signed out.
 */
export function useCampaigns() {
  const saved = useSavedOpportunities();
  const outreach = useOutreach();
  const products = useProducts();

  const [rows, setRows] = useState<svc.RawCampaign[]>([]);
  const [links, setLinks] = useState<{ campaignId: string; creatorId: string }[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setHydrated(true);
      return;
    }
    try {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) {
        setHydrated(true);
        return;
      }
      const [c, l] = await Promise.all([
        svc.listCampaigns(sb, user.id),
        svc.listResultLinks(sb, user.id),
      ]);
      setRows(c);
      setLinks(l);
      setHydrated(true);
    } catch {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** campaignId → creatorIds. Exposed so Reports can aggregate without re-querying. */
  const creatorLinks = useMemo(() => {
    const byCampaign = new Map<string, string[]>();
    for (const r of links) {
      const arr = byCampaign.get(r.campaignId) ?? [];
      arr.push(r.creatorId);
      byCampaign.set(r.campaignId, arr);
    }
    return byCampaign;
  }, [links]);

  const campaigns: Campaign[] = useMemo(() => {
    const byCampaign = creatorLinks;
    const savedSet = new Set(saved.saved.map((s) => s.id));
    const productName = (id: string | null) =>
      id ? (products.products.find((p) => p.id === id)?.name ?? null) : null;

    const list = rows.map((c) => {
      const creatorIds = byCampaign.get(c.id) ?? [];
      const summary = computeSummary(c.resultCount, creatorIds, savedSet, outreach.records);
      const lastAction = computeLastAction(c, creatorIds, savedSet, outreach.records);
      return {
        ...c,
        productName: productName(c.productId),
        summary,
        lastAction,
      } satisfies Campaign;
    });
    // Favourites first, then newest.
    return list.sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [rows, creatorLinks, saved.saved, outreach.records, products.products]);

  const mutate = useCallback(
    async (id: string, patch: svc.CampaignPatch, optimistic: Partial<svc.RawCampaign>) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...optimistic } : r)));
      try {
        const sb = createClient();
        await svc.updateCampaign(sb, id, patch);
        return true;
      } catch {
        await reload(); // revert to server truth
        return false;
      }
    },
    [reload],
  );

  const setLabel = useCallback(
    (id: string, label: CampaignLabel) => mutate(id, { label }, { label }),
    [mutate],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      const cur = rows.find((r) => r.id === id)?.favorite ?? false;
      return mutate(id, { favorite: !cur }, { favorite: !cur });
    },
    [mutate, rows],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const prevRows = rows;
      const prevLinks = links;
      setRows((r) => r.filter((x) => x.id !== id));
      setLinks((l) => l.filter((x) => x.campaignId !== id));
      try {
        const sb = createClient();
        await svc.deleteCampaign(sb, id);
        return true;
      } catch {
        setRows(prevRows);
        setLinks(prevLinks);
        return false;
      }
    },
    [rows, links],
  );

  return {
    campaigns,
    creatorLinks,
    hydrated: hydrated && saved.hydrated && outreach.hydrated,
    setLabel,
    toggleFavorite,
    remove,
    reload,
  };
}
