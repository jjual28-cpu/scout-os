'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { queryKeys } from '@/lib/query-keys';

import { type AnalyzeCreatorInput } from '../schemas';

export function useAnalyzeCreator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AnalyzeCreatorInput) => api.post('/api/analysis', input),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.analysis.forCreator(input.creatorId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.creators.detail(input.creatorId) });
    },
  });
}
