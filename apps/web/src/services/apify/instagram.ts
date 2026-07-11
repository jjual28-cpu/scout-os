import 'server-only';

import { type InstagramCreator } from '@/features/search/instagram';
import { AppError } from '@/lib/api/response';
import { env } from '@/lib/env';

/**
 * INACTIVE PROVIDER — kept intentionally.
 *
 * Instagram discovery now defaults to the local Playwright worker
 * (`packages/worker`), selected via `DISCOVERY_PROVIDER`. This Apify-based
 * provider remains available as an alternate: set `DISCOVERY_PROVIDER=apify`
 * (with `APIFY_API_TOKEN`) and the route will call `runInstagramDiscovery`
 * inline again. Do not delete — it is a supported, swappable provider.
 */

const APIFY_BASE = 'https://api.apify.com/v2';

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

/** Defensively map a raw Apify item to our normalized creator (field names vary by actor). */
function normalize(raw: any): InstagramCreator | null {
  const o = (raw ?? {}) as Record<string, any>;
  const username =
    pickStr(o, ['username', 'ownerUsername']) ??
    pickStr((o.owner as Record<string, any>) ?? {}, ['username']) ??
    pickStr((o.user as Record<string, any>) ?? {}, ['username']);
  if (!username) return null;

  const displayName = pickStr(o, ['fullName', 'full_name', 'displayName', 'name']) ?? username;

  return {
    id: `instagram:${username.toLowerCase()}`,
    platform: 'instagram',
    username,
    displayName,
    // Requirement: always this exact form.
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
 * Run the configured Apify Instagram actor for a search term / hashtag and return
 * normalized public-profile data. Server-only — the APIFY_API_TOKEN never reaches
 * the browser. Throws `AppError` with a Korean message on any failure.
 */
export async function runInstagramDiscovery(input: RunInput): Promise<InstagramCreator[]> {
  const token = env.APIFY_API_TOKEN;
  if (!token) {
    throw new AppError('APIFY_NOT_CONFIGURED', 'Instagram 연동이 설정되지 않았습니다.', 503);
  }

  const search = (input.hashtag ?? input.query ?? '').trim();
  if (!search) {
    throw new AppError('INVALID_QUERY', '검색어 또는 해시태그를 입력해 주세요.', 400);
  }
  const limit = Math.min(Math.max(input.limit ?? 12, 1), 30);

  const actorInput = input.hashtag
    ? { search, searchType: 'hashtag', searchLimit: 1, resultsType: 'details', resultsLimit: limit }
    : {
        search,
        searchType: 'user',
        searchLimit: limit,
        resultsType: 'details',
        resultsLimit: limit,
      };

  let res: Response;
  try {
    res = await fetch(
      `${APIFY_BASE}/acts/${encodeURIComponent(env.APIFY_INSTAGRAM_ACTOR)}/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actorInput),
      },
    );
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

  let items: unknown;
  try {
    items = await res.json();
  } catch {
    throw new AppError('APIFY_PARSE', 'Instagram 응답을 처리하지 못했습니다.', 502);
  }
  if (!Array.isArray(items)) return [];

  const seen = new Set<string>();
  const creators: InstagramCreator[] = [];
  for (const raw of items) {
    const creator = normalize(raw);
    if (!creator) continue;
    const key = creator.username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    creators.push(creator);
    if (creators.length >= limit) break;
  }
  return creators;
}
