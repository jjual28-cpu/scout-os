'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { queryKeys } from '@/lib/query-keys';

import { type DiscoveryRunInput } from '../schemas';

type DiscoveryRunResult = {
  id: string;
  status: string;
  resultCount: number;
};

/**
 * Trigger an AI discovery run. On success, invalidates the creators list so the
 * grid refreshes with newly discovered creators.
 */
export function useDiscoveryRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DiscoveryRunInput) =>
      api.post<DiscoveryRunResult>('/api/discovery/runs', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.creators.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.discovery.runs() });
    },
  });
}
