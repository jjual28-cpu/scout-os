'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useOutreach } from '@/features/search/hooks/use-outreach';
import { useSavedOpportunities } from '@/features/search/hooks/use-saved-opportunities';
import { useProducts } from '@/features/products';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

import * as svc from '../services/campaign-service';
import { computeSummary } from '../summary';
import { type CampaignLabel, type CampaignResult, type CampaignSummary } from '../types';

type State = {
  status: 'loading' | 'ready' | 'notfound' | 'unavailable';
  campaign: svc.RawCampaign | null;
  results: CampaignResult[];
};

/** One campaign + its result snapshots, with a live derived funnel + edit actions. */
export function useCampaign(id: string) {
  const saved = useSavedOpportunities();
  const outreach = useOutreach();
  const products = useProducts();

  const [state, setState] = useState<State>({
    status: 'loading',
    campaign: null,
    results: [],
  });

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setState({ status: 'unavailable', campaign: null, results: [] });
      return;
    }
    try {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) {
        setState({ status: 'unavailable', campaign: null, results: [] });
        return;
      }
      const campaign = await svc.getCampaign(sb, user.id, id);
      if (!campaign) {
        setState({ status: 'notfound', campaign: null, results: [] });
        return;
      }
      const results = await svc.listResults(sb, user.id, id);
      setState({ status: 'ready', campaign, results });
    } catch {
      setState({ status: 'unavailable', campaign: null, results: [] });
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const summary: CampaignSummary = useMemo(() => {
    const savedSet = new Set(saved.saved.map((s) => s.id));
    const creatorIds = state.results.map((r) => r.externalId);
    return computeSummary(creatorIds.length, creatorIds, savedSet, outreach.records);
  }, [state.results, saved.saved, outreach.records]);

  const productName = useMemo(() => {
    const pid = state.campaign?.productId;
    return pid ? (products.products.find((p) => p.id === pid)?.name ?? null) : null;
  }, [state.campaign?.productId, products.products]);

  const mutate = useCallback(
    async (patch: svc.CampaignPatch) => {
      if (!state.campaign) return false;
      const prev = state.campaign;
      setState((s) =>
        s.campaign ? { ...s, campaign: { ...s.campaign, ...patch } as svc.RawCampaign } : s,
      );
      try {
        const sb = createClient();
        await svc.updateCampaign(sb, prev.id, patch);
        return true;
      } catch {
        setState((s) => ({ ...s, campaign: prev }));
        return false;
      }
    },
    [state.campaign],
  );

  const setLabel = useCallback((label: CampaignLabel) => mutate({ label }), [mutate]);
  const toggleFavorite = useCallback(
    () => mutate({ favorite: !(state.campaign?.favorite ?? false) }),
    [mutate, state.campaign?.favorite],
  );
  const updateMeta = useCallback((patch: svc.CampaignPatch) => mutate(patch), [mutate]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!state.campaign) return false;
    try {
      const sb = createClient();
      await svc.deleteCampaign(sb, state.campaign.id);
      return true;
    } catch {
      return false;
    }
  }, [state.campaign]);

  return {
    ...state,
    summary,
    productName,
    products: products.products,
    setLabel,
    toggleFavorite,
    updateMeta,
    remove,
  };
}
