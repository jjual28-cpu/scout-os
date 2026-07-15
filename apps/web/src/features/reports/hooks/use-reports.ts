'use client';

import { useMemo } from 'react';

import { useCampaigns } from '@/features/campaigns/hooks/use-campaigns';
import { useOutreach } from '@/features/search/hooks/use-outreach';
import { useSavedOpportunities } from '@/features/search/hooks/use-saved-opportunities';

import {
  cohort,
  computeKpis,
  productRows,
  topCampaigns,
  topQueries,
  type Cohort,
  type ProductRow,
  type ReportKpis,
  type TopCampaign,
  type TopQuery,
} from '../compute';
import { type RangeKey } from '../range';

export type ReportData = {
  cohort: Cohort;
  kpis: ReportKpis;
  topQueries: TopQuery[];
  topCampaigns: TopCampaign[];
  products: ProductRow[];
  hydrated: boolean;
};

/**
 * Read-only report over data the app already has in memory — no new queries, no
 * API route, no Apify/OpenAI call. Every underlying store swallows its own fetch
 * errors and reports `hydrated`, so a failing table degrades that slice to zero
 * instead of taking the page down.
 *
 * `now` is passed in (not read here) to keep the aggregation deterministic and
 * avoid a re-render loop from a fresh Date on every pass.
 */
export function useReports(range: RangeKey, now: Date): ReportData {
  const { campaigns, creatorLinks, hydrated } = useCampaigns();
  const saved = useSavedOpportunities();
  const outreach = useOutreach();

  const savedSet = useMemo(() => new Set(saved.saved.map((s) => s.id)), [saved.saved]);
  const nowMs = now.getTime();

  return useMemo(() => {
    const at = new Date(nowMs);
    const c = cohort(campaigns, range, at);
    const records = outreach.records;
    return {
      cohort: c,
      kpis: computeKpis(c, creatorLinks, savedSet, records),
      topQueries: topQueries(c, creatorLinks, savedSet, records),
      topCampaigns: topCampaigns(c, creatorLinks, savedSet, records),
      products: productRows(c, creatorLinks, savedSet, records),
      hydrated,
    };
  }, [campaigns, creatorLinks, savedSet, outreach.records, range, nowMs, hydrated]);
}
