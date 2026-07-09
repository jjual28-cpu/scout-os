/**
 * Centralised React Query key factory. Keeping keys in one place prevents typos
 * and makes cache invalidation predictable across features.
 */
export const queryKeys = {
  creators: {
    all: ['creators'] as const,
    list: (filters?: Record<string, unknown>) => ['creators', 'list', filters ?? {}] as const,
    detail: (id: string) => ['creators', 'detail', id] as const,
  },
  discovery: {
    all: ['discovery'] as const,
    runs: () => ['discovery', 'runs'] as const,
    run: (id: string) => ['discovery', 'run', id] as const,
    savedSearches: () => ['discovery', 'saved-searches'] as const,
  },
  analysis: {
    forCreator: (creatorId: string) => ['analysis', creatorId] as const,
  },
  crm: {
    deals: (filters?: Record<string, unknown>) => ['crm', 'deals', filters ?? {}] as const,
    deal: (id: string) => ['crm', 'deal', id] as const,
    pipeline: (campaignId?: string) => ['crm', 'pipeline', campaignId ?? 'all'] as const,
  },
  campaigns: {
    all: ['campaigns'] as const,
    detail: (id: string) => ['campaigns', id] as const,
  },
  outreach: {
    forDeal: (dealId: string) => ['outreach', dealId] as const,
  },
} as const;
