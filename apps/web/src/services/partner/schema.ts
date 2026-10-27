import { z } from 'zod';

/**
 * Request body of POST /api/partner/recommend — the Cellink ↔ Scout OS contract
 * (cellink/docs/plans/2026-10-26-scout-os-partner-api.md, v2). Unknown keys are
 * stripped (not rejected) so Cellink can add fields without breaking us.
 */

const word = z.string().trim().min(1).max(40);
const optionalText = (max: number) => z.string().trim().max(max).nullish();

export const brandProfileSchema = z.object({
  summary: optionalText(200),
  audienceGender: z.enum(['female', 'male', 'any']).nullish(),
  audienceAges: z.array(z.string().trim().min(1).max(20)).max(8).nullish(),
  priceRange: optionalText(60),
  styleKeywords: z.array(word).max(10).nullish(),
});

export const filtersSchema = z.object({
  followerMin: z.number().int().min(0).nullish(),
  followerMax: z.number().int().min(0).nullish(),
  /** 0~1 ratio. The 2% baseline always applies — this can only raise it. */
  minEngagementRate: z.number().min(0).max(1).nullish(),
  /** The 30-day baseline always applies — this can only shorten it. */
  recentDays: z.number().int().min(1).max(365).nullish(),
  contentFormats: z
    .array(z.enum(['reels', 'feed']))
    .max(2)
    .nullish(),
  mustKeywords: z.array(word).max(10).nullish(),
  excludeKeywords: z.array(word).max(20).nullish(),
  excludeUsernames: z.array(z.string().trim().min(1).max(60)).max(1000).nullish(),
});

export const recommendRequestSchema = z.object({
  mallId: z.string().trim().min(1).max(100),
  orgId: z.string().trim().max(100).nullish(),
  keywords: z.array(word).min(1).max(5),
  productName: z.string().trim().min(1).max(200),
  productDescription: optionalText(500),
  productPrice: z.number().min(0).nullish(),
  category: optionalText(100),
  target: z.enum(['creator', 'gonggu']).nullish(),
  limit: z.number().int().min(1).max(20).nullish(),
  brandProfile: brandProfileSchema.nullish(),
  filters: filtersSchema.nullish(),
  notes: optionalText(300),
});

export type RecommendRequest = z.infer<typeof recommendRequestSchema>;
export type RecommendFilters = z.infer<typeof filtersSchema>;

/** One recommended creator in the GET response (contract shape). */
export type RecommendedCreator = {
  username: string;
  displayName: string;
  profileUrl: string;
  profileImageUrl: string | null;
  followersCount: number | null;
  engagementRate: number | null;
  isFakeSuspect: boolean;
  aiScore: number;
  aiVerdict: 'fit';
  aiReason: string;
  reasons: string[];
  evidence: { postUrl: string; caption: string; takenAt: string | null }[];
};

/** Which baseline a near miss fell short of (contract v2.1). */
export type BelowBaseline = 'engagement' | 'recent_activity' | 'followers';

/**
 * "조금 아쉬운 분" — AI-fit but short of a numeric baseline, or AI-'maybe' with a
 * decent score (belowBaseline may then be empty). Sent while `creators` has
 * fewer than 5 (contract v2.2, additive).
 */
export type NearMissCreator = Omit<RecommendedCreator, 'aiVerdict'> & {
  aiVerdict: 'fit' | 'maybe';
  belowBaseline: BelowBaseline[];
};
