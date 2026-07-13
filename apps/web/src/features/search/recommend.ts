import { type DiscoverOpportunity } from './discover-mock';
import { type InstagramCreator } from './instagram';

/**
 * Rule-based "AI recommendation" — human-readable reasons a creator is worth
 * reaching out to, derived from the data we already collect (bio, category,
 * followers, posts, verification). No external AI/API. This replaces the raw
 * opportunity score as the primary signal on cards.
 */

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

export type CreatorSignals = {
  hasEmail: boolean;
  isBusiness: boolean;
  groupBuy: boolean;
  reels: boolean;
  brand: boolean;
};

export function creatorSignals(c: {
  biography?: string | null;
  category?: string | null;
  rawData?: unknown;
}): CreatorSignals {
  const bio = c.biography ?? '';
  const raw = (c.rawData ?? {}) as Record<string, unknown>;
  return {
    hasEmail: EMAIL_RE.test(bio),
    isBusiness: Boolean(raw.isBusinessAccount) || Boolean(c.category),
    groupBuy: /공구|공동구매|마켓|market|공동 구매/i.test(bio),
    reels: /릴스|reels|숏폼|영상 제작|영상제작/i.test(bio),
    brand: /브랜드|공식|official|스토어|store|샵|shop|대표|자체 ?제작|런칭|launch/i.test(bio),
  };
}

/** Clean Apify's category (sometimes "None,Digital creator") into one label. */
function cleanCategory(category: string | null | undefined): string | null {
  if (!category) return null;
  const parts = category
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && p.toLowerCase() !== 'none');
  return parts[0] ?? null;
}

/** Up to 4 concise recommendation reasons. */
export function recommendReasons(c: InstagramCreator): string[] {
  const s = creatorSignals(c);
  const reasons: string[] = [];
  if (s.groupBuy) reasons.push('공동구매 경험');
  if (s.reels) reasons.push('릴스 활발');
  if (s.brand) reasons.push('브랜드 운영');
  const cat = cleanCategory(c.category);
  if (cat) reasons.push(cat);

  const f = c.followersCount ?? 0;
  if (f >= 100_000) reasons.push('대형 인플루언서');
  else if (f >= 10_000) reasons.push('탄탄한 팬층');
  else if (f >= 1_000) reasons.push('성장 중인 마이크로');

  if (s.hasEmail) reasons.push('연락처 공개');
  if (c.isVerified) reasons.push('인증 계정');

  return [...new Set(reasons)].slice(0, 4);
}

/** Data-derived summary bullets for the AI Summary card above the results. */
export function summarizeResults(items: DiscoverOpportunity[]): string[] {
  const n = items.length;
  if (n === 0) return [];

  const followers = items.map((i) => i.followersCount ?? 0);
  const midTier = followers.filter((f) => f >= 5_000 && f <= 30_000).length;
  const large = followers.filter((f) => f >= 100_000).length;
  const verified = items.filter((i) => i.isVerified).length;
  const has = (label: string) => items.filter((i) => i.reasons?.includes(label)).length;
  const groupBuy = has('공동구매 경험');
  const reels = has('릴스 활발');
  const brand = has('브랜드 운영');
  const email = has('연락처 공개');

  const lines = [`검색 결과 ${n}명`];
  if (midTier) lines.push(`팔로워 5천~3만 계정 ${midTier}곳 다수`);
  if (large) lines.push(`10만+ 대형 계정 ${large}곳`);
  if (groupBuy) lines.push(`공동구매 가능성이 높은 계정 ${groupBuy}곳`);
  if (reels) lines.push(`릴스 활동이 활발한 계정 ${reels}곳`);
  if (brand) lines.push(`브랜드 운영 계정 ${brand}곳`);
  if (email) lines.push(`연락처(이메일) 공개 ${email}곳`);
  if (verified) lines.push(`인증 계정 ${verified}곳`);
  return lines.slice(0, 6);
}
