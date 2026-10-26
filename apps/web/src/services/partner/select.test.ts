import { describe, expect, it } from 'vitest';

import { cacheKeyFor, mergeHashtags, partnerContextBlock } from './context';
import { recommendRequestSchema, type RecommendRequest } from './schema';
import {
  resolveEvidence,
  selectRecommended,
  selectWithNearMisses,
  snapshotToCreator,
  type JudgedRow,
} from './select';

const NOW = Date.parse('2026-10-26T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

function post(i: number, d = 3, format: 'reels' | 'feed' = 'feed', caption = `캠핑 텀블러 ${i}`) {
  return { url: `https://www.instagram.com/p/code${i}/`, caption, takenAt: daysAgo(d), format };
}

function row(over: Record<string, unknown> = {}, snap: Record<string, unknown> = {}): JudgedRow {
  return {
    ai_score: 80,
    ai_verdict: 'fit',
    ai_reason: '캠핑 장비 리뷰를 꾸준히 올림',
    ai_evidence: ['P1'],
    ...over,
    creator_snapshot: {
      externalId: 'instagram:camper',
      username: 'camper',
      displayName: '캠퍼',
      profileUrl: 'https://www.instagram.com/camper/',
      profileImageUrl: null,
      biography: '주말 캠핑 브이로그',
      followersCount: 12_000,
      postsCount: 300,
      isVerified: false,
      category: 'Digital creator',
      lastPostAt: daysAgo(3),
      recentAvgLikes: 400,
      recentAvgComments: 20, // 420 / 12000 = 3.5%
      recentPosts: [post(1), post(2, 10, 'reels')],
      ...snap,
    },
  };
}

const noReject = () => false;
const base = { target: 'creator' as const, limit: 10, now: NOW, reject: noReject };

describe('selectRecommended — baselines', () => {
  it('keeps a fit creator with evidence and maps the contract fields', () => {
    const [c] = selectRecommended([row()], base);
    expect(c).toBeDefined();
    expect(c!.engagementRate).toBeCloseTo(0.035, 3);
    expect(c!.aiVerdict).toBe('fit');
    expect(c!.isFakeSuspect).toBe(false);
    expect(c!.evidence).toEqual([
      {
        postUrl: 'https://www.instagram.com/p/code1/',
        caption: '캠핑 텀블러 1',
        takenAt: daysAgo(3),
      },
    ]);
    expect(c!.reasons.length).toBeGreaterThan(0);
  });

  it('drops non-fit verdicts', () => {
    expect(selectRecommended([row({ ai_verdict: 'maybe' })], base)).toHaveLength(0);
    expect(selectRecommended([row({ ai_verdict: null })], base)).toHaveLength(0);
  });

  it('drops a fit without evidence (or with made-up post numbers)', () => {
    expect(selectRecommended([row({ ai_evidence: [] })], base)).toHaveLength(0);
    expect(selectRecommended([row({ ai_evidence: ['P9'] })], base)).toHaveLength(0);
    expect(selectRecommended([row({ ai_evidence: null })], base)).toHaveLength(0);
  });

  it('enforces engagement ≥ 2% and unknown engagement fails', () => {
    // 200 / 12000 = 1.7%
    expect(
      selectRecommended([row({}, { recentAvgLikes: 190, recentAvgComments: 10 })], base),
    ).toHaveLength(0);
    expect(
      selectRecommended([row({}, { recentAvgLikes: null, recentAvgComments: null })], base),
    ).toHaveLength(0);
  });

  it('filters.minEngagementRate can only raise the bar', () => {
    const r = row(); // 3.5%
    expect(selectRecommended([r], { ...base, filters: { minEngagementRate: 0.05 } })).toHaveLength(
      0,
    );
    expect(selectRecommended([r], { ...base, filters: { minEngagementRate: 0.001 } })).toHaveLength(
      1,
    );
  });

  it('requires a post within 30 days; recentDays can only shorten', () => {
    expect(selectRecommended([row({}, { lastPostAt: daysAgo(40) })], base)).toHaveLength(0);
    expect(selectRecommended([row({}, { lastPostAt: null })], base)).toHaveLength(0);
    expect(selectRecommended([row()], { ...base, filters: { recentDays: 2 } })).toHaveLength(0);
    expect(selectRecommended([row()], { ...base, filters: { recentDays: 90 } })).toHaveLength(1);
  });

  it('drops fake-follower suspects (same rule as the Discover screen)', () => {
    // 200k followers, 0.1% engagement → under 0.3 × 0.5
    const fake = row({}, { followersCount: 200_000, recentAvgLikes: 5000, recentAvgComments: 0 });
    // 2.5% so it passes the 2% bar but isn't fake → kept
    expect(selectRecommended([fake], base)).toHaveLength(1);
    const fake2 = row({}, { followersCount: 200_000, recentAvgLikes: 100, recentAvgComments: 0 });
    expect(selectRecommended([fake2], { ...base, filters: { minEngagementRate: 0 } })).toHaveLength(
      0,
    );
  });

  it('applies the shop/brand rejection hook and excludeUsernames', () => {
    expect(selectRecommended([row()], { ...base, reject: () => true })).toHaveLength(0);
    expect(
      selectRecommended([row()], { ...base, filters: { excludeUsernames: ['@Camper'] } }),
    ).toHaveLength(0);
  });
});

describe('selectRecommended — filters', () => {
  it('follower range', () => {
    expect(selectRecommended([row()], { ...base, filters: { followerMin: 20_000 } })).toHaveLength(
      0,
    );
    expect(selectRecommended([row()], { ...base, filters: { followerMax: 10_000 } })).toHaveLength(
      0,
    );
    expect(
      selectRecommended([row()], {
        ...base,
        filters: { followerMin: 1_000, followerMax: 100_000 },
      }),
    ).toHaveLength(1);
  });

  it('content formats', () => {
    const feedOnly = row({}, { recentPosts: [post(1)] });
    expect(
      selectRecommended([feedOnly], { ...base, filters: { contentFormats: ['reels'] } }),
    ).toHaveLength(0);
    expect(
      selectRecommended([row()], { ...base, filters: { contentFormats: ['reels'] } }),
    ).toHaveLength(1);
  });

  it('must / exclude keywords look at bio and captions', () => {
    expect(
      selectRecommended([row()], { ...base, filters: { mustKeywords: ['캠핑'] } }),
    ).toHaveLength(1);
    expect(
      selectRecommended([row()], { ...base, filters: { mustKeywords: ['골프'] } }),
    ).toHaveLength(0);
    expect(
      selectRecommended([row()], { ...base, filters: { excludeKeywords: ['브이로그'] } }),
    ).toHaveLength(0);
  });

  it('sorts by AI score and respects limit', () => {
    const rows = [10, 95, 60].map((s, i) =>
      row({ ai_score: s }, { username: `u${i}`, externalId: `instagram:u${i}` }),
    );
    const out = selectRecommended(rows, { ...base, limit: 2 });
    expect(out.map((c) => c.aiScore)).toEqual([95, 60]);
  });
});

describe('nearMisses (v2.1)', () => {
  const u = (name: string, over: Record<string, unknown>, snap: Record<string, unknown>) =>
    row(over, { username: name, externalId: `instagram:${name}`, ...snap });

  it('fills only when nobody passed, tags the missed baselines, sorts by score, max 3', () => {
    const lowEr = { recentAvgLikes: 180, recentAvgComments: 10 }; // 190/12000 = 1.6%
    const rows = [
      u('a', { ai_score: 70 }, lowEr),
      u('b', { ai_score: 90 }, { lastPostAt: daysAgo(40) }),
      u('c', { ai_score: 80 }, { ...lowEr, lastPostAt: daysAgo(40) }),
      u('d', { ai_score: 60 }, lowEr),
      u('e', { ai_score: 99, ai_verdict: 'reject' }, lowEr), // not fit → never
      u('f', { ai_score: 98, ai_evidence: [] }, lowEr), // no evidence → never
    ];
    const { creators, nearMisses } = selectWithNearMisses(rows, base);
    expect(creators).toHaveLength(0);
    expect(nearMisses.map((c) => [c.username, c.belowBaseline])).toEqual([
      ['b', ['recent_activity']],
      ['c', ['engagement', 'recent_activity']],
      ['a', ['engagement']],
    ]);
    expect(nearMisses[2]!.engagementRate).toBeCloseTo(0.016);
  });

  it('is empty when at least one creator passed', () => {
    const rows = [row(), u('x', {}, { recentAvgLikes: 10, recentAvgComments: 0 })];
    const out = selectWithNearMisses(rows, base);
    expect(out.creators).toHaveLength(1);
    expect(out.nearMisses).toEqual([]);
  });

  it('follower range is a near miss, hard rules are not', () => {
    const f = selectWithNearMisses([row()], { ...base, filters: { followerMin: 20_000 } });
    expect(f.nearMisses[0]!.belowBaseline).toEqual(['followers']);
    expect(selectWithNearMisses([row()], { ...base, reject: () => true }).nearMisses).toEqual([]);
    expect(
      selectWithNearMisses([row()], { ...base, filters: { mustKeywords: ['골프'] } }).nearMisses,
    ).toEqual([]);
  });
});

describe('evidence', () => {
  it('resolves P-numbers to real https posts, max 3, no duplicates', () => {
    const c = snapshotToCreator(
      row({}, { recentPosts: [post(1), post(2), post(3), post(4)] }).creator_snapshot,
    )!;
    expect(resolveEvidence(c, ['P1', 'p1', 'P2', 'P3', 'P4']).map((p) => p.url)).toEqual([
      'https://www.instagram.com/p/code1/',
      'https://www.instagram.com/p/code2/',
      'https://www.instagram.com/p/code3/',
    ]);
    const bad = snapshotToCreator(
      row({}, { recentPosts: [{ ...post(1), url: 'http://evil.example/p/1' }] }).creator_snapshot,
    )!;
    expect(resolveEvidence(bad, ['P1'])).toEqual([]);
  });
});

describe('request schema & context', () => {
  const valid = {
    mallId: 'ovokorea',
    orgId: '7d1f0e7e-5d5b-4c3e-9b0a-1d2c3b4a5f60',
    keywords: ['텀블러', '캠핑'],
    productName: 'MAG FLOW 스텐 텀블러 500ml',
    category: null,
    target: 'creator',
    limit: 10,
    brandProfile: {
      summary: '감성 캠핑·홈카페 리빙 브랜드',
      audienceGender: 'female',
      audienceAges: ['20s', '30s'],
      priceRange: '2~5만 원대',
      styleKeywords: ['감성', '미니멀'],
    },
    filters: { excludeKeywords: ['육아'], excludeUsernames: ['a'] },
    notes: '캠핑하는 30대 여성',
  };

  it('accepts the contract example and rejects bad input', () => {
    expect(recommendRequestSchema.safeParse(valid).success).toBe(true);
    expect(recommendRequestSchema.safeParse({ ...valid, keywords: [] }).success).toBe(false);
    expect(
      recommendRequestSchema.safeParse({ ...valid, keywords: ['1', '2', '3', '4', '5', '6'] })
        .success,
    ).toBe(false);
    expect(recommendRequestSchema.safeParse({ ...valid, limit: 21 }).success).toBe(false);
    expect(recommendRequestSchema.safeParse({ ...valid, target: 'brand' }).success).toBe(false);
    expect(recommendRequestSchema.safeParse({ ...valid, notes: 'x'.repeat(301) }).success).toBe(
      false,
    );
    const { mallId: _m, ...noMall } = valid;
    expect(recommendRequestSchema.safeParse(noMall).success).toBe(false);
  });

  it('cache key ignores order/case/filters but not brand profile or product', () => {
    const a = recommendRequestSchema.parse(valid) as RecommendRequest;
    const b = recommendRequestSchema.parse({
      ...valid,
      keywords: ['캠핑', ' 텀블러 '],
      filters: { followerMin: 5000 },
      limit: 3,
    }) as RecommendRequest;
    expect(cacheKeyFor(a)).toBe(cacheKeyFor(b));
    const c = recommendRequestSchema.parse({
      ...valid,
      brandProfile: { ...valid.brandProfile, audienceGender: 'male' },
    }) as RecommendRequest;
    expect(cacheKeyFor(c)).not.toBe(cacheKeyFor(a));
    const d = recommendRequestSchema.parse({
      ...valid,
      productName: '다른 상품',
    }) as RecommendRequest;
    expect(cacheKeyFor(d)).not.toBe(cacheKeyFor(a));
  });

  it('context block carries brand profile, product, filters and notes', () => {
    const t = partnerContextBlock(recommendRequestSchema.parse(valid) as RecommendRequest);
    for (const s of [
      '감성 캠핑·홈카페',
      '여성 20대·30대',
      '2~5만 원대',
      'MAG FLOW',
      '육아',
      '캠핑하는 30대 여성',
    ]) {
      expect(t).toContain(s);
    }
  });

  it('hashtags: user keywords lead, AI tags fill, max 6', () => {
    expect(
      mergeHashtags(
        ['텀블러', '캠핑'],
        ['캠핑용품', '#텀블러', '캠핑스타그램', '감성캠핑', '홈카페', '차박'],
      ),
    ).toEqual(['텀블러', '캠핑', '캠핑용품', '캠핑스타그램', '감성캠핑', '홈카페']);
  });
});
