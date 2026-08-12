import 'server-only';

import { type InstagramCreator } from '@/features/search/instagram';
import { AppError } from '@/lib/api/response';
import { env } from '@/lib/env';

/**
 * Topic-based Instagram creator discovery via the Apify `instagram-scraper` actor.
 *
 * A single user search only matches accounts whose NAME contains the keyword, so
 * niche topics (e.g. "키링") return almost nothing. This runs a staged search:
 *   1. user/profile search for the keyword                         (1 Apify call)
 *   2. if that's sparse → hashtag/post search over rule-expanded    (1 Apify call)
 *      keywords, extract the POST AUTHORS' usernames
 *   3. dedupe usernames, then fetch profile DETAILS for the authors (1 Apify call)
 * Common keywords stop at step 1 (1 call); only sparse ones pay for 2–3.
 * Server-only — the APIFY_API_TOKEN never reaches the browser.
 */

const APIFY_BASE = 'https://api.apify.com/v2';

/** First-pass target (also the hard cap). Keeps Apify cost bounded. */
const TARGET = 20;
/** If user-search alone yields at least this many, skip the expansion calls. */
const MIN_SUFFICIENT = 12;
/** Posts to scrape across the expanded hashtags in the fallback pass. */
const POSTS_LIMIT = 50;

/* eslint-disable @typescript-eslint/no-explicit-any -- Apify dataset items are untyped external JSON */

function pickStr(o: Record<string, any>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function pickNum(o: Record<string, any>, keys: string[]): number | null {
  for (const k of keys) {
    const v = o?.[k];
    const n = v && typeof v === 'object' ? Number(v.count) : Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function validUsername(u: string): boolean {
  return /^[a-zA-Z0-9._]{1,30}$/.test(u);
}

/**
 * Is this a real PROFILE object (not a post)? Profile-detail items carry
 * follower/following/posts/biography; post items don't. Guards against post
 * objects ever becoming creator cards.
 */
function isProfileLike(o: any): boolean {
  if (!o || typeof o !== 'object') return false;
  const r = o as Record<string, any>;
  return (
    typeof r.followersCount === 'number' ||
    typeof r.followsCount === 'number' ||
    typeof r.postsCount === 'number' ||
    typeof r.biography === 'string'
  );
}

/** Post author username (from a hashtag/post dataset item). */
function postAuthorUsername(o: any): string | null {
  const r = (o ?? {}) as Record<string, any>;
  const u =
    pickStr(r, ['ownerUsername']) ?? pickStr((r.owner as Record<string, any>) ?? {}, ['username']);
  return u && validUsername(u) ? u : null;
}

/**
 * Recent-activity signals from the profile's `latestPosts` (the details scrape
 * returns ~12). This is what tells a rising creator from a big-but-dead account:
 * followers alone can't — an account with 67k followers whose last post was a
 * year ago is not "요즘 뜨는". Missing/empty → all null (judged the old way).
 */
function recentActivity(raw: Record<string, any>): {
  lastPostAt: string | null;
  recentAvgLikes: number | null;
  recentAvgComments: number | null;
} {
  const posts = Array.isArray(raw?.latestPosts) ? raw.latestPosts : [];
  let newestMs: number | null = null;
  const likes: number[] = [];
  const comments: number[] = [];
  for (const p of posts) {
    const t = Date.parse(String(p?.timestamp ?? ''));
    if (Number.isFinite(t)) newestMs = newestMs === null ? t : Math.max(newestMs, t);
    const l = Number(p?.likesCount);
    if (Number.isFinite(l) && l >= 0) likes.push(l); // Apify uses -1 for hidden likes
    const c = Number(p?.commentsCount);
    if (Number.isFinite(c) && c >= 0) comments.push(c);
  }
  const avg = (a: number[]) =>
    a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null;
  return {
    lastPostAt: newestMs === null ? null : new Date(newestMs).toISOString(),
    recentAvgLikes: avg(likes),
    recentAvgComments: avg(comments),
  };
}

/** Map a raw Apify PROFILE item to our normalized creator. */
function normalize(raw: any): InstagramCreator | null {
  const o = (raw ?? {}) as Record<string, any>;
  const username =
    pickStr(o, ['username']) ??
    pickStr((o.owner as Record<string, any>) ?? {}, ['username']) ??
    pickStr((o.user as Record<string, any>) ?? {}, ['username']);
  if (!username || !validUsername(username)) return null;

  const displayName = pickStr(o, ['fullName', 'full_name', 'displayName', 'name']) ?? username;

  return {
    id: `instagram:${username.toLowerCase()}`,
    platform: 'instagram',
    username,
    displayName,
    profileUrl: `https://www.instagram.com/${username}/`,
    profileImageUrl: pickStr(o, [
      'profilePicUrl',
      'profilePicUrlHD',
      'profile_pic_url',
      'profileImage',
      'profilePicture',
    ]),
    biography: pickStr(o, ['biography', 'bio']),
    followersCount: pickNum(o, ['followersCount', 'followers', 'edge_followed_by']),
    followingCount: pickNum(o, ['followsCount', 'followingCount', 'following', 'edge_follow']),
    // ⚠️ igtvVideoCount 를 넣으면 안 된다 — IGTV를 안 올리는 대부분의 계정에서 0이라,
    // postsCount 가 없을 때 0으로 잘못 채워져 "게시물 0개"로 보이고 필터에 걸린다.
    postsCount: pickNum(o, ['postsCount', 'mediaCount', 'edge_owner_to_timeline_media']),
    isVerified: Boolean(o.verified ?? o.isVerified ?? o.is_verified),
    category: pickStr(o, ['businessCategoryName', 'category', 'categoryName']),
    externalUrl:
      pickStr(o, ['externalUrl', 'externalUrlShimmed']) ??
      pickStr((Array.isArray(o.bioLinks) ? o.bioLinks[0] : {}) as Record<string, any>, [
        'url',
        'lprUrl',
      ]),
    isBusinessAccount: Boolean(o.isBusinessAccount ?? o.isBusiness ?? o.is_business_account),
    ...recentActivity(o),
    rawData: raw,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Rule-based keyword expansion (generic — NOT hardcoded per keyword). Produces
 * the "content community" hashtags around a topic so we find creators who make
 * content about it, not just accounts named after it. This is the single pluggable
 * point — swap the body for an AI expander later without touching the search flow.
 */
export function expandKeyword(query: string): string[] {
  const base = query.replace(/[#\s]+/g, '');
  if (!base) return [];
  const variants = [
    base,
    `${base}스타그램`,
    `${base}그램`,
    `${base}만들기`,
    `${base}일상`,
    `${base}추천`,
  ];
  return [...new Set(variants)].slice(0, 6);
}

// ═══════════════════════════════════════════════════════════════════════════
// Async run API — start a run, poll its status, read its dataset.
// Used by the Campaign state machine so a search never blocks a request.
// The staged pipeline (and therefore search quality) is unchanged; each stage
// is just started/collected across separate requests instead of awaited inline.
// ═══════════════════════════════════════════════════════════════════════════

/** Apify run lifecycle states we care about. */
export type ApifyRunStatus =
  'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTING' | 'ABORTED' | 'TIMED-OUT';

export type StartedRun = { runId: string; datasetId: string };

function apifyToken(): string {
  const token = env.APIFY_API_TOKEN;
  if (!token) {
    throw new AppError('APIFY_NOT_CONFIGURED', 'Instagram 연동이 설정되지 않았습니다.', 503);
  }
  return token;
}

function apifyActorId(): string {
  return env.APIFY_INSTAGRAM_ACTOR.replace('/', '~');
}

/** Actor that returns posts TAGGING a given account (different actor, same run API). */
function taggedActorId(): string {
  return env.APIFY_TAGGED_ACTOR.replace('/', '~');
}

/**
 * Start an actor run WITHOUT waiting for it. Returns the run + dataset ids.
 * `actorId` defaults to the Instagram scraper; the tagged scraper passes its own.
 */
export async function startActorRun(
  actorInput: unknown,
  actorId: string = apifyActorId(),
): Promise<StartedRun> {
  const token = apifyToken();
  let res: Response;
  try {
    res = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actorInput),
    });
  } catch {
    throw new AppError('APIFY_NETWORK', 'Instagram 검색을 시작하지 못했습니다.', 502);
  }
  if (!res.ok) {
    throw new AppError(
      'APIFY_ERROR',
      `Instagram 검색을 시작하지 못했습니다. (오류 ${res.status})`,
      502,
    );
  }
  const json = (await res.json().catch(() => null)) as {
    data?: { id?: string; defaultDatasetId?: string };
  } | null;
  const runId = json?.data?.id;
  const datasetId = json?.data?.defaultDatasetId;
  if (!runId || !datasetId) {
    throw new AppError('APIFY_PARSE', 'Instagram 검색 시작 응답을 처리하지 못했습니다.', 502);
  }
  return { runId, datasetId };
}

/** Current status of a run. `null` when the run can't be found/read. */
export async function getRunStatus(
  runId: string,
): Promise<{ status: ApifyRunStatus; datasetId: string | null } | null> {
  const token = apifyToken();
  try {
    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { status?: string; defaultDatasetId?: string };
    };
    const status = json?.data?.status as ApifyRunStatus | undefined;
    if (!status) return null;
    return { status, datasetId: json.data?.defaultDatasetId ?? null };
  } catch {
    return null;
  }
}

/** Read a finished run's dataset items. */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export async function readDataset(datasetId: string): Promise<any[]> {
  const token = apifyToken();
  let res: Response;
  try {
    res = await fetch(
      `${APIFY_BASE}/datasets/${datasetId}/items?clean=true&format=json&token=${token}`,
    );
  } catch {
    throw new AppError('APIFY_NETWORK', 'Instagram 결과를 불러오지 못했습니다.', 502);
  }
  if (!res.ok) {
    throw new AppError(
      'APIFY_ERROR',
      `Instagram 결과를 불러오지 못했습니다. (오류 ${res.status})`,
      502,
    );
  }
  const items = await res.json().catch(() => null);
  return Array.isArray(items) ? items : [];
}

// ── Stage inputs (identical shapes to the synchronous pipeline) ─────────────

/** Stage 1 — user/profile search for the keyword. */
export function stage1Input(query: string, limit?: number) {
  const target = Math.min(Math.max(limit ?? TARGET, 1), 24);
  return {
    search: query,
    searchType: 'user',
    searchLimit: target,
    resultsType: 'details',
    resultsLimit: target,
  };
}

/**
 * Stage 2 — hashtag/post search.
 *
 * `tags` comes from the AI search plan when the user wrote a sentence; the
 * rule-based expansion is only a fallback (it produces junk for phrases, e.g.
 * "신생 바디케어 브랜드 찾아줘" → #신생바디케어브랜드찾아줘스타그램).
 */
export function stage2Input(query: string, tags?: string[]) {
  const tags_ = tags?.length ? tags.slice(0, 6) : expandKeyword(query);
  return buildStage2(tags_);
}

function buildStage2(tags: string[]) {
  return {
    directUrls: tags.map((t) => `https://www.instagram.com/explore/tags/${encodeURIComponent(t)}/`),
    resultsType: 'posts',
    resultsLimit: POSTS_LIMIT,
  };
}

/**
 * Tagged search — posts that TAG the given account(s).
 *
 * This is the high-signal entrance: whoever tags a cosmetics brand is already
 * doing brand content, unlike a hashtag match. The actor returns POSTS (with the
 * author's username) and no follower/bio data, so the authors still go through
 * the same enrichment pass as hashtag authors do.
 */
export function taggedInput(handles: string[], limit = 40) {
  return {
    username: handles,
    resultsLimit: Math.min(Math.max(limit, 1), 100),
  };
}

/** Actor id for the tagged run (callers pass this to startActorRun). */
export function taggedActor(): string {
  return taggedActorId();
}

/** "@Brand_Name " / a profile URL → "brand_name". Empty when unusable. */
export function normalizeHandle(raw: string): string {
  const t = raw.trim().replace(/^@/, '');
  const fromUrl = t.match(/instagram\.com\/([^/?#]+)/i)?.[1] ?? t;
  const clean = fromUrl.trim().replace(/\/+$/, '');
  return validUsername(clean) ? clean : '';
}

/** Stage 3 — enrich post-author usernames into full profile details. */
export function stage3Input(usernames: string[]) {
  return {
    directUrls: usernames.map((u) => `https://www.instagram.com/${u}/`),
    resultsType: 'details',
    resultsLimit: usernames.length,
  };
}

// ── Stage processors ────────────────────────────────────────────────────────

/** Normalize dataset items → creators (post objects are never let through). */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function profilesFromItems(items: any[]): InstagramCreator[] {
  const out = new Map<string, InstagramCreator>();
  for (const raw of items) {
    if (!isProfileLike(raw)) continue;
    const c = normalize(raw);
    if (!c) continue;
    const k = c.username.toLowerCase();
    if (!out.has(k)) out.set(k, c);
  }
  return [...out.values()];
}

/** Post-author usernames from a posts dataset, excluding ones we already have. */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function authorsFromPosts(items: any[], exclude: Iterable<string>): string[] {
  const seen = new Set([...exclude].map((u) => u.toLowerCase()));
  const authors: string[] = [];
  for (const p of items) {
    const u = postAuthorUsername(p);
    if (!u) continue;
    const k = u.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    authors.push(u);
  }
  return authors;
}

/** Search-quality knobs shared with the state machine (unchanged values). */
export const SEARCH_TARGET = TARGET;
export const SEARCH_MIN_SUFFICIENT = MIN_SUFFICIENT;
/** Stage-3 enrichment cap (mirrors the synchronous pipeline's buffer). */
export function stage3Cap(need: number): number {
  return Math.min(Math.max(need, 0) + 6, 40);
}
