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
  /**
   * Recent-activity signals from the profile's latest posts — the difference
   * between a genuinely rising creator and a big-but-dead account. All optional/
   * null: older snapshots and non-detail scrapes won't have them.
   */
  lastPostAt?: string | null; // ISO timestamp of the newest recent post
  recentAvgLikes?: number | null; // avg likes across the fetched recent posts
  recentAvgComments?: number | null; // avg comments across the fetched recent posts
  rawData: unknown;
};

/** A rough 0–99 opportunity score from follower reach + verification. */
function scoreFor(creator: InstagramCreator): number {
  const followers = creator.followersCount ?? 0;
  const base = Math.min(90, Math.round(Math.log10(followers + 10) * 18));
  return Math.max(1, Math.min(99, base + (creator.isVerified ? 6 : 0)));
}

/**
 * 참여율(%) = (최근 평균 좋아요 + 댓글) ÷ 팔로워 × 100. 협업 가치를 실제로 가르는
 * 지표 — 팔로워보다 "진짜 영향력"을 본다. 최근 게시물 데이터가 없으면 null.
 */
export function engagementRate(c: InstagramCreator): number | null {
  const f = c.followersCount ?? 0;
  if (f <= 0) return null;
  if (c.recentAvgLikes == null && c.recentAvgComments == null) return null;
  const eng = (c.recentAvgLikes ?? 0) + (c.recentAvgComments ?? 0);
  return Math.round((eng / f) * 1000) / 10; // 소수 첫째자리 %
}

/**
 * 가짜 팔로워 의심 — 팔로워는 많은데 반응(참여율)이 비정상적으로 낮은 계정.
 * 보수적으로 판단(오탐 최소화): 2만 이상인데 참여율 0.8% 미만.
 */
export function isFakeSuspect(c: InstagramCreator, er: number | null): boolean {
  return er != null && (c.followersCount ?? 0) >= 20_000 && er < 0.8;
}

/** 소개글에서 이메일 추출(있으면). 협업 연락 채널로 쓴다. */
export function extractEmail(bio: string | null): string | null {
  if (!bio) return null;
  const m = bio.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : null;
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

  const er = engagementRate(creator);
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
    engagementRate: er,
    fakeSuspect: isFakeSuspect(creator, er),
    email: extractEmail(creator.biography),
  };
}
