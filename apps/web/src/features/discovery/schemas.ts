import { z } from 'zod';

import { CreatorType, Platform } from '@scout-os/database';

/**
 * Zod schemas for the Discovery feature. These are the single source of truth
 * for both client-side form validation and server-side request validation.
 */

export const platformEnum = z.nativeEnum(Platform);
export const creatorTypeEnum = z.nativeEnum(CreatorType);

/** Structured filter payload used by search + saved searches. */
export const creatorFiltersSchema = z.object({
  query: z.string().trim().max(200).optional(),
  platforms: z.array(platformEnum).optional(),
  types: z.array(creatorTypeEnum).optional(),
  categories: z.array(z.string()).optional(),
  niches: z.array(z.string()).optional(),
  minFollowers: z.number().int().min(0).optional(),
  maxFollowers: z.number().int().min(0).optional(),
  minEngagement: z.number().min(0).max(100).optional(),
  minOpportunityScore: z.number().int().min(0).max(100).optional(),
  location: z.string().optional(),
  sort: z
    .object({
      field: z.enum(['opportunityScore', 'totalFollowers', 'avgEngagement', 'discoveredAt']),
      direction: z.enum(['asc', 'desc']),
    })
    .default({ field: 'opportunityScore', direction: 'desc' }),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(24),
});

export type CreatorFilters = z.infer<typeof creatorFiltersSchema>;

/** Input for kicking off an AI discovery run from a natural-language brief. */
export const discoveryRunInputSchema = z.object({
  prompt: z.string().trim().min(4, '무엇을 찾을지 조금 더 설명해 주세요').max(1000),
  platforms: z.array(platformEnum).min(1, '플랫폼을 하나 이상 선택하세요'),
  types: z.array(creatorTypeEnum).optional(),
  targetCount: z.number().int().min(1).max(200).default(50),
  savedSearchId: z.string().uuid().optional(),
});

export type DiscoveryRunInput = z.infer<typeof discoveryRunInputSchema>;

/** Input for persisting a saved search. */
export const savedSearchInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional(),
  filters: creatorFiltersSchema.partial(),
  isPinned: z.boolean().default(false),
});

export type SavedSearchInput = z.infer<typeof savedSearchInputSchema>;
