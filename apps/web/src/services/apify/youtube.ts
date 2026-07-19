import 'server-only';

import { type InstagramCreator } from '@/features/search/instagram';
import { env } from '@/lib/env';

/**
 * 유튜브 크리에이터 발굴 — Apify 유튜브 스크레이퍼.
 *
 * 틱톡과 같은 단일 수집 흐름: 키워드로 영상을 검색하면 각 영상에 채널 메타(채널명·
 * 핸들·구독자·소개)가 붙어 온다. 그걸 채널 단위로 중복제거해 크리에이터를 뽑는다.
 * 실행/폴링/데이터셋 읽기는 apify/instagram.ts 재사용(액터 id만 다름).
 *
 * ⚠️ 유튜브 액터마다 입력·출력 필드 편차가 커서, 입력은 여러 후보 키를 함께 넣고
 * (안 쓰는 키는 무시됨) 출력은 방어적으로 여러 후보 키를 시도한다. 첫 실검색 로그로
 * 실제 필드를 확인해 맞출 것.
 */

/** 유튜브 액터 id (slug의 '/'를 '~'로). */
export function youtubeActorId(): string {
  return env.APIFY_YOUTUBE_ACTOR.replace('/', '~');
}

/** 키워드 검색 입력. 액터별 입력키 편차가 커서 여러 후보 키를 함께 넣는다(잉여 무시). */
export function youtubeInput(keywords: string[], limit = 24) {
  const terms = keywords
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 6);
  const query = terms.join(' ');
  const max = Math.min(Math.max(limit, 1), 50);
  return {
    // 검색어 — 액터마다 searchKeywords / searchQueries / keywords 중 하나를 씀.
    searchKeywords: query,
    searchQueries: terms,
    keywords: terms,
    // 개수 상한 — maxResults / maxResultsPerQuery 중 하나.
    maxResults: max,
    maxResultsPerQuery: max,
    maxResultsShorts: 0,
    maxResultStreams: 0,
    // 영상 다운로드 안 함 — 채널 메타만 필요.
    downloadSubtitles: false,
  };
}

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
    const n = v && typeof v === 'object' ? Number(v.count ?? v.value) : Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** 채널 URL/핸들에서 username(@handle 또는 채널 slug)을 뽑는다. */
function usernameFromChannel(o: Record<string, any>): string | null {
  const direct = pickStr(o, [
    'channelUsername',
    'channelHandle',
    'handle',
    'username',
    'ownerUsername',
  ]);
  if (direct) return direct.replace(/^@/, '');
  const url = pickStr(o, ['channelUrl', 'channelUrI', 'url', 'ownerUrl']);
  if (url) {
    // .../@handle  또는  .../channel/UC…  또는  .../c/name  둘 다 잡는다.
    const at = url.match(/@([A-Za-z0-9._-]+)/);
    if (at) return at[1]!;
    const seg = url.match(/\/(?:channel|c|user)\/([A-Za-z0-9._-]+)/);
    if (seg) return seg[1]!;
  }
  return null;
}

function validYoutubeUser(u: string): boolean {
  return /^[A-Za-z0-9._-]{1,60}$/.test(u);
}

/**
 * 영상 데이터셋 → 채널(크리에이터) 정규화 + 중복제거.
 * 각 영상에 붙은 채널 메타에서 채널명·구독자·소개를 뽑는다.
 */
export function creatorsFromYoutube(items: any[]): InstagramCreator[] {
  const out = new Map<string, InstagramCreator>();
  for (const raw of items) {
    // 채널 메타는 최상위이거나 channel/author/snippet 안에 있을 수 있다.
    const c: Record<string, any> = {
      ...(raw ?? {}),
      ...((raw?.channel as Record<string, any>) ?? {}),
      ...((raw?.author as Record<string, any>) ?? {}),
      ...((raw?.snippet as Record<string, any>) ?? {}),
    };
    const username = usernameFromChannel(c);
    if (!username || !validYoutubeUser(username)) continue;
    const key = username.toLowerCase();
    if (out.has(key)) continue;

    const displayName =
      pickStr(c, ['channelName', 'channelTitle', 'channelTitleText', 'author', 'ownerName']) ??
      username;
    const profileUrl =
      pickStr(c, ['channelUrl', 'ownerUrl']) ?? `https://www.youtube.com/@${username}`;

    out.set(key, {
      id: `youtube:${key}`,
      platform: 'youtube',
      username,
      displayName,
      profileUrl,
      profileImageUrl: pickStr(c, [
        'channelAvatar',
        'channelThumbnail',
        'avatar',
        'thumbnailUrl',
        'ownerThumbnail',
      ]),
      biography: pickStr(c, [
        'channelDescription',
        'description',
        'channelDescriptionText',
        'aboutChannelInfo',
      ]),
      followersCount: pickNum(c, [
        'numberOfSubscribers',
        'subscriberCount',
        'channelSubscriberCount',
        'subscribers',
      ]),
      followingCount: null,
      postsCount: pickNum(c, ['channelTotalVideos', 'videosCount', 'numberOfVideos']),
      isVerified: Boolean(c?.isChannelVerified ?? c?.verified ?? c?.channelVerified),
      category: null,
      rawData: raw,
    });
  }
  return [...out.values()];
}
/* eslint-enable @typescript-eslint/no-explicit-any */
