import { describe, expect, it } from 'vitest';

import { type InstagramCreator } from '@/features/search/instagram';

import { looksLikeLocalBiz, looksLikeSeller, rejectForTarget } from './advance';

// 10-28 셀링크 품질 테스트에서 실제 크리에이터가 AI 판정 전에 규칙으로 빠지던 두 경우.
function creator(p: Partial<InstagramCreator>): InstagramCreator {
  return {
    id: `instagram:${p.username ?? 'x'}`,
    platform: 'instagram',
    username: 'x',
    displayName: 'x',
    profileUrl: 'https://www.instagram.com/x/',
    profileImageUrl: null,
    biography: null,
    followersCount: 2000,
    followingCount: null,
    postsCount: 100,
    isVerified: false,
    category: null,
    externalUrl: null,
    isBusinessAccount: false,
    lastPostAt: null,
    recentAvgLikes: null,
    recentAvgComments: null,
    recentPosts: null,
    rawData: null,
    ...p,
  };
}

describe('looksLikeSeller — 이름에 검색어', () => {
  it('개인 크리에이터가 주제어(데일리룩)를 이름에 넣어도 판매자가 아니다', () => {
    const c = creator({ username: 'from_k0', displayName: '프롬코의  데일리룩' });
    expect(looksLikeSeller(c, '데일리룩')).toBe(false);
  });

  it('비즈니스 계정이 제품명을 이름에 넣으면 판매자다', () => {
    const c = creator({
      username: 'ts_tumbler',
      displayName: '텀블러 하우스',
      isBusinessAccount: true,
    });
    expect(looksLikeSeller(c, '텀블러')).toBe(true);
  });

  it('공식·official 같은 판매 신호는 비즈니스 여부와 상관없이 판매자다', () => {
    const c = creator({ username: 'delyou.officially', displayName: '델유' });
    expect(looksLikeSeller(c, '데일리룩')).toBe(true);
  });
});

describe('looksLikeLocalBiz — 필라테스', () => {
  it('요가·필라테스 강사 크리에이터는 매장이 아니다', () => {
    const c = creator({
      username: '9dan_a2',
      biography: '요가•필라테스 강사 | 김단아 건강하고 무해한 삶의 기록',
    });
    expect(looksLikeLocalBiz(c)).toBe(false);
    expect(rejectForTarget(c, 'creator')).toBe(false);
  });

  it('필라테스 + 원장/본점/지점이면 매장이다', () => {
    expect(looksLikeLocalBiz(creator({ biography: "'바름다움 필라테스' 원장" }))).toBe(true);
    expect(looksLikeLocalBiz(creator({ displayName: '하루 필라테스 본점 | 수성구' }))).toBe(true);
  });

  it('카테고리가 Pilates Studio면 매장이다', () => {
    expect(looksLikeLocalBiz(creator({ category: 'Pilates Studio' }))).toBe(true);
  });

  it('기존 매장 신호(예약문의 등)는 그대로 매장이다', () => {
    expect(looksLikeLocalBiz(creator({ biography: '체형교정 필라테스 · 예약문의 DM' }))).toBe(true);
  });
});
