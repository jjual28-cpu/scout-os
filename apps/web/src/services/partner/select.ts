import {
  engagementRate,
  isFakeSuspect,
  type InstagramCreator,
  type RecentPost,
} from '@/features/search/instagram';
import { recommendReasons } from '@/features/search/recommend';
import { clipText } from '@/lib/utils';
import { type SearchTarget } from '@/services/ai/match';

import { BASELINE_MIN_ER, BASELINE_RECENT_DAYS } from './context';
import { type RecommendFilters, type RecommendedCreator } from './schema';

/**
 * Final, deterministic pick of what Cellink gets to see. The AI already judged
 * every candidate; this enforces the contract's baselines on top of it, so a
 * lenient verdict can never leak a weak account:
 *   verdict fit · 참여율 ≥ 2% · 최근 30일 게시물 · 가짜 팔로워 의심 제외 ·
 *   쇼핑몰/브랜드 제외 · excludeUsernames 제외 · 근거 게시물 1개 이상
 * plus the request's own filters (which can only narrow), sorted by AI score.
 */

/** A campaign_results row as read for the partner API. */
export type JudgedRow = {
  creator_snapshot: unknown;
  ai_score: number | null;
  ai_verdict: string | null;
  ai_reason: string | null;
  ai_evidence: unknown;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- stored snapshots are jsonb */
export function snapshotToCreator(s: any): InstagramCreator | null {
  if (!s || typeof s.username !== 'string') return null;
  return {
    id: s.externalId ?? `instagram:${String(s.username).toLowerCase()}`,
    platform: 'instagram',
    username: s.username,
    displayName: s.displayName ?? s.username,
    profileUrl: s.profileUrl ?? `https://www.instagram.com/${s.username}/`,
    profileImageUrl: s.profileImageUrl ?? null,
    biography: s.biography ?? null,
    followersCount: s.followersCount ?? null,
    followingCount: s.followingCount ?? null,
    postsCount: s.postsCount ?? null,
    isVerified: Boolean(s.isVerified),
    category: s.category ?? null,
    externalUrl: s.externalUrl ?? null,
    isBusinessAccount: Boolean(s.isBusinessAccount),
    lastPostAt: s.lastPostAt ?? null,
    recentAvgLikes: s.recentAvgLikes ?? null,
    recentAvgComments: s.recentAvgComments ?? null,
    recentPosts: Array.isArray(s.recentPosts) ? (s.recentPosts as RecentPost[]) : null,
    rawData: null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const POST_URL_RE = /^https:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+\/?/;

/** AI's "P1"… picks → the creator's real posts (valid https links only, max 3). */
export function resolveEvidence(c: InstagramCreator, ids: unknown): RecentPost[] {
  if (!Array.isArray(ids)) return [];
  const posts = c.recentPosts ?? [];
  const out: RecentPost[] = [];
  for (const id of ids) {
    const m = /^P(\d{1,2})$/i.exec(String(id).trim());
    if (!m) continue;
    const p = posts[Number(m[1]) - 1];
    if (!p || !POST_URL_RE.test(p.url) || out.includes(p)) continue;
    out.push(p);
    if (out.length >= 3) break;
  }
  return out;
}

export type SelectOptions = {
  target: SearchTarget;
  filters?: RecommendFilters | null;
  limit: number;
  now?: number;
  /** Rule-based shop/brand/org rejection (rejectForTarget from the search machine). */
  reject: (c: InstagramCreator, target: SearchTarget) => boolean;
};

function haystack(c: InstagramCreator): string {
  return [
    c.username,
    c.displayName,
    c.biography ?? '',
    c.category ?? '',
    ...(c.recentPosts ?? []).map((p) => p.caption),
  ]
    .join(' ')
    .toLowerCase();
}

export function selectRecommended(rows: JudgedRow[], opts: SelectOptions): RecommendedCreator[] {
  const now = opts.now ?? Date.now();
  const f = opts.filters ?? {};
  const minEr = Math.max(BASELINE_MIN_ER, f.minEngagementRate ?? 0);
  const days = Math.min(BASELINE_RECENT_DAYS, f.recentDays ?? BASELINE_RECENT_DAYS);
  const since = now - days * 86_400_000;
  const exclude = new Set(
    (f.excludeUsernames ?? []).map((u) => u.trim().replace(/^@/, '').toLowerCase()),
  );
  const must = (f.mustKeywords ?? []).map((k) => k.toLowerCase());
  const banned = (f.excludeKeywords ?? []).map((k) => k.toLowerCase());
  const formats = new Set(f.contentFormats ?? []);

  const picked: RecommendedCreator[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.ai_verdict !== 'fit') continue;
    const c = snapshotToCreator(r.creator_snapshot);
    if (!c) continue;
    const key = c.username.toLowerCase();
    if (seen.has(key) || exclude.has(key)) continue;

    if (opts.reject(c, opts.target)) continue;

    const erPct = engagementRate(c); // % (소수 첫째자리) — 화면과 같은 계산
    if (erPct == null || erPct / 100 < minEr) continue;
    if (isFakeSuspect(c, erPct)) continue;

    const last = c.lastPostAt ? Date.parse(c.lastPostAt) : NaN;
    if (!Number.isFinite(last) || last < since) continue;

    const followers = c.followersCount;
    if (f.followerMin != null && (followers == null || followers < f.followerMin)) continue;
    if (f.followerMax != null && (followers == null || followers > f.followerMax)) continue;

    if (formats.size > 0 && !(c.recentPosts ?? []).some((p) => formats.has(p.format))) continue;

    if (must.length > 0 || banned.length > 0) {
      const h = haystack(c);
      if (!must.every((k) => h.includes(k))) continue;
      if (banned.some((k) => h.includes(k))) continue;
    }

    const evidence = resolveEvidence(c, r.ai_evidence);
    if (evidence.length === 0) continue; // 근거를 못 대면 탈락

    seen.add(key);
    picked.push({
      username: c.username,
      displayName: c.displayName || c.username,
      profileUrl: c.profileUrl || `https://www.instagram.com/${c.username}/`,
      profileImageUrl: c.profileImageUrl,
      followersCount: c.followersCount,
      engagementRate: Math.round(erPct * 10) / 1000, // % → 0~1 (예: 3.4 → 0.034)
      isFakeSuspect: false,
      aiScore: r.ai_score ?? 0,
      aiVerdict: 'fit',
      aiReason: r.ai_reason ?? '',
      reasons: recommendReasons(c),
      evidence: evidence.map((p) => ({
        postUrl: p.url,
        caption: clipText(p.caption, 80),
        takenAt: p.takenAt,
      })),
    });
  }

  picked.sort((a, b) => b.aiScore - a.aiScore);
  return picked.slice(0, opts.limit);
}
