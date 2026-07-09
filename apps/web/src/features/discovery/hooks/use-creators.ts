'use client';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { queryKeys } from '@/lib/query-keys';
import { type PaginatedResult } from '@/types/common';

import { type CreatorFilters } from '../schemas';
import { type CreatorSummary } from '../types';

function toSearchParams(filters: Partial<CreatorFilters>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value == null) return;
    params.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  });
  return params.toString();
}

/** Fetch a paginated list of creators matching the given filters. */
export function useCreators(filters: Partial<CreatorFilters>) {
  return useQuery({
    queryKey: queryKeys.creators.list(filters),
    queryFn: () =>
      api.get<PaginatedResult<CreatorSummary>>(`/api/creators?${toSearchParams(filters)}`),
    placeholderData: (prev) => prev, // keep previous page while fetching next
  });
}
