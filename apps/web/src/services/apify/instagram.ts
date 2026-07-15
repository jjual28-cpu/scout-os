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

type RunInput = { query?: string; hashtag?: string; limit?: number };

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
    postsCount: pickNum(o, ['postsCount', 'igtvVideoCount', 'edge_owner_to_timeline_media']),
    isVerified: Boolean(o.verified ?? o.isVerified ?? o.is_verified),
    category: pickStr(o, ['businessCategoryName', 'category', 'categoryName']),
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

/** Start an actor run WITHOUT waiting for it. Returns the run + dataset ids. */
export async function startActorRun(actorInput: unknown): Promise<StartedRun> {
  const token = apifyToken();
  let res: Response;
  try {
    res = await fetch(`${APIFY_BASE}/acts/${apifyActorId()}/runs?token=${token}`, {
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

/** Stage 2 — hashtag/post search over rule-expanded keywords. */
export function stage2Input(query: string) {
  const tags = expandKeyword(query);
  return {
    directUrls: tags.map((t) => `https://www.instagram.com/explore/tags/${encodeURIComponent(t)}/`),
    resultsType: 'posts',
    resultsLimit: POSTS_LIMIT,
  };
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
  return Math.min(Math.max(need, 0) + 4, 24);
}

/** Run the Apify actor once and return its dataset items. Throws AppError on failure. */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
async function runActor(actorId: string, token: string, actorInput: unknown): Promise<any[]> {
  let res: Response;
  try {
    res = await fetch(`${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actorInput),
    });
  } catch {
    throw new AppError(
      'APIFY_NETWORK',
      'Instagram 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      502,
    );
  }
  if (!res.ok) {
    throw new AppError(
      'APIFY_ERROR',
      `Instagram 데이터를 불러오지 못했습니다. (오류 ${res.status})`,
      502,
    );
  }
  try {
    const items = await res.json();
    return Array.isArray(items) ? items : [];
  } catch {
    throw new AppError('APIFY_PARSE', 'Instagram 응답을 처리하지 못했습니다.', 502);
  }
}

export async function runInstagramDiscovery(input: RunInput): Promise<InstagramCreator[]> {
  const token = env.APIFY_API_TOKEN;
  if (!token) {
    throw new AppError('APIFY_NOT_CONFIGURED', 'Instagram 연동이 설정되지 않았습니다.', 503);
  }

  const query = (input.query ?? input.hashtag ?? '').trim();
  if (!query) {
    throw new AppError('INVALID_QUERY', '검색어를 입력해 주세요.', 400);
  }
  const target = Math.min(Math.max(input.limit ?? TARGET, 1), 24);
  const actorId = env.APIFY_INSTAGRAM_ACTOR.replace('/', '~');

  const creators = new Map<string, InstagramCreator>();
  const addProfile = (raw: unknown) => {
    if (!isProfileLike(raw)) return; // never let a post object become a card
    const c = normalize(raw);
    if (c) {
      const k = c.username.toLowerCase();
      if (!creators.has(k)) creators.set(k, c);
    }
  };

  // ── Stage 1: user/profile search ──────────────────────────────────────────
  const usersA = await runActor(actorId, token, {
    search: query,
    searchType: 'user',
    searchLimit: target,
    resultsType: 'details',
    resultsLimit: target,
  });
  usersA.forEach(addProfile);

  // Common keyword → enough real profiles already; stop at 1 Apify call.
  if (creators.size >= Math.min(target, MIN_SUFFICIENT)) {
    return [...creators.values()].slice(0, target);
  }

  // ── Stage 2: hashtag/post search over expanded keywords → author usernames ─
  const tags = expandKeyword(query);
  const directUrls = tags.map(
    (t) => `https://www.instagram.com/explore/tags/${encodeURIComponent(t)}/`,
  );
  const posts = await runActor(actorId, token, {
    directUrls,
    resultsType: 'posts',
    resultsLimit: POSTS_LIMIT,
  });

  const authors: string[] = [];
  const seen = new Set<string>([...creators.keys()]);
  for (const p of posts) {
    const u = postAuthorUsername(p);
    if (!u) continue;
    const k = u.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    authors.push(u);
  }

  // ── Stage 3: enrich the author usernames into full profile details ────────
  const need = Math.max(target - creators.size, 0);
  const toEnrich = authors.slice(0, Math.min(need + 4, 24)); // small buffer, capped
  if (toEnrich.length > 0) {
    const profileUrls = toEnrich.map((u) => `https://www.instagram.com/${u}/`);
    const details = await runActor(actorId, token, {
      directUrls: profileUrls,
      resultsType: 'details',
      resultsLimit: toEnrich.length,
    });
    details.forEach(addProfile);
  }

  return [...creators.values()].slice(0, target);
}
