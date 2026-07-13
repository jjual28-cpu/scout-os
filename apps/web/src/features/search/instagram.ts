import { formatCompactNumber } from '@/lib/utils';

import { type DiscoverOpportunity } from './discover-mock';
import { recommendReasons } from './recommend';
import { type SearchResultType } from './types';

/**
 * Normalized Instagram creator — the shape the `/api/discover/instagram` route
 * returns (and the `discovered_creators` table stores). Provider-agnostic so the
 * UI never depends on Apify's raw output.
 */
export type InstagramCreator = {
  id: string;
  platform: 'instagram';
  username: string;
  displayName: string;
  profileUrl: string;
  profileImageUrl: string | null;
  biography: string | null;
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  isVerified: boolean;
  category: string | null;
  rawData: unknown;
};

/** A rough 0–99 opportunity score from follower reach + verification. */
function scoreFor(creator: InstagramCreator): number {
  const followers = creator.followersCount ?? 0;
  const base = Math.min(90, Math.round(Math.log10(followers + 10) * 18));
  return Math.max(1, Math.min(99, base + (creator.isVerified ? 6 : 0)));
}

/**
 * Map a normalized creator onto the existing discover-card shape so real data
 * renders through the SAME card as the mock feed (no card redesign).
 */
export function toDiscoverOpportunity(creator: InstagramCreator): DiscoverOpportunity {
  const followers = creator.followersCount ?? 0;
  const type: SearchResultType = followers < 100_000 ? '마이크로 크리에이터' : '니치 크리에이터';

  const bio = creator.biography?.trim();
  const reason = bio
    ? bio
    : `팔로워 ${formatCompactNumber(followers)}${
        creator.postsCount != null ? ` · 게시물 ${formatCompactNumber(creator.postsCount)}` : ''
      }`;

  return {
    id: creator.id,
    name: creator.displayName || creator.username,
    handle: creator.username,
    type,
    platform: 'instagram',
    reason,
    opportunityScore: scoreFor(creator),
    recommendedAction: '제품 시딩 후 협업 제안하기',
    discoveredAt: '오늘',
    profileUrl: creator.profileUrl,
    profileImageUrl: creator.profileImageUrl,
    followersCount: creator.followersCount,
    reasons: recommendReasons(creator),
    isVerified: creator.isVerified,
    category: creator.category,
    postsCount: creator.postsCount,
    biography: creator.biography,
  };
}
