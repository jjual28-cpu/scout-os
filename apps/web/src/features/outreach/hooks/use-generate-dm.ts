'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import { queryKeys } from '@/lib/query-keys';
import { type OutreachMessage } from '@/types';

import { type GenerateDmInput } from '../schemas';

/** Ask the AI to draft a DM / follow-up for a deal. */
export function useGenerateDm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GenerateDmInput) =>
      api.post<OutreachMessage>('/api/outreach/generate', input),
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.outreach.forDeal(input.dealId) });
    },
  });
}
