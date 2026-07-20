import { formatCompactNumber } from '@/lib/utils';

import { type DiscoverOpportunity } from './discover-mock';
import { recommendReasons } from './recommend';
import { type SearchPlatform, type SearchResultType } from './types';

/**
 * Normalized Instagram creator — the shape the `/api/discover/instagram` route
 * returns (and the `discovered_creators` table stores). Provider-agnostic so the
 * UI never depends on Apify's raw output.
 */
export type InstagramCreator = {
  id: string;
  /** 소셜 플랫폼 — 인스타 외 틱톡/유튜브도 같은 파이프라인을 탄다. */
  platform: SearchPlatform;
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
 * 규모별 "건강한 참여율" 하한(%). 큰 계정일수록 참여율이 자연히 낮으므로 기준도
 * 낮아진다. (평평한 기준을 쓰면 메가셀럽이 저참여로 오판되고, 팔로워 몇십 명짜리
 * 계정은 좋아요 몇 개만으로 참여율이 수백%가 되어 되레 통과한다.)
 */
function lowErThreshold(followers: number): number {
  if (followers < 10_000) return 1.0;
  if (followers < 100_000) return 0.6;
  if (followers < 1_000_000) return 0.3;
  return 0.15;
}

/**
 * 참여율 낮은(사실상 죽은) 계정 — 규모 대비 반응이 낮을 때. 팔로워가 너무 적으면
 * (1천 미만) 참여율이 불안정해 판단하지 않는다(오탐 방지).
 */
export function isLowEngagement(c: InstagramCreator, er: number | null): boolean {
  const f = c.followersCount ?? 0;
  if (er == null || f < 1_000) return false;
  return er < lowErThreshold(f);
}

/**
 * 가짜 팔로워 의심 — 팔로워는 큰데 참여율이 규모 기준의 절반에도 못 미치는 계정만.
 * 매우 보수적(5만 이상 + 규모기준×0.5 미만)이라 정상 메가셀럽은 걸리지 않는다.
 */
export function isFakeSuspect(c: InstagramCreator, er: number | null): boolean {
  const f = c.followersCount ?? 0;
  if (er == null || f < 50_000) return false;
  return er < lowErThreshold(f) * 0.5;
}

/** 소개글에서 이메일 추출(있으면). 협업 연락 채널로 쓴다. */
export function extractEmail(bio: string | null): string | null {
  if (!bio) return null;
  const m = bio.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : null;
}

/**
 * 한국 크리에이터 "추정" — 이름·소개글에 한글이 있으면 한국계로 본다. 글로벌 플랫폼
 * (특히 틱톡)에서 외국 계정을 걸러내는 데 쓴다. 측정이 아니라 텍스트 기반 추정 —
 * 소개를 영어로만 쓴 한국 크리에이터는 놓칠 수 있음(그래서 옵션·'추정' 표기).
 */
const HANGUL_RE = /[가-힣]/;
export function looksKorean(c: InstagramCreator): boolean {
  return HANGUL_RE.test(`${c.displayName ?? ''} ${c.biography ?? ''}`);
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
    platform: creator.platform,
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
    lowEngagement: isLowEngagement(creator, er),
    email: extractEmail(creator.biography),
    koreanLikely: looksKorean(creator),
  };
}
