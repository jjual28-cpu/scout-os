import 'server-only';

import { type InstagramCreator } from '@/features/search/instagram';
import { env } from '@/lib/env';

/**
 * 틱톡 크리에이터 발굴 — Apify 틱톡 해시태그 스크레이퍼.
 *
 * 인스타의 3단계(이름검색→해시태그→상세)와 달리, 틱톡 해시태그 스크레이퍼는 영상과
 * 함께 작성자 메타(아이디·팔로워·소개·인증·아바타)를 한 번에 준다. 그래서 단일
 * 수집으로 크리에이터를 뽑는다. 실행/폴링/데이터셋 읽기는 apify/instagram.ts 재사용.
 *
 * ⚠️ 액터마다 입력·출력 필드가 조금씩 달라, 방어적으로 여러 후보 키를 시도한다.
 * 첫 실검색 로그로 실제 필드를 확인해 맞출 것.
 */

/** 틱톡 액터 id (slug의 '/'를 '~'로). */
export function tiktokActorId(): string {
  return env.APIFY_TIKTOK_ACTOR.replace('/', '~');
}

/** 해시태그 검색 입력. keywords 각각을 해시태그로 훑는다. */
export function tiktokInput(keywords: string[], limit = 24) {
  const tags = keywords
    .map((k) => k.trim().replace(/^#/, '').replace(/\s+/g, ''))
    .filter(Boolean)
    .slice(0, 6);
  return {
    hashtags: tags,
    resultsPerPage: Math.min(Math.max(limit, 1), 30),
    // 일부 액터는 아래 키를 쓴다 — 무시돼도 무해.
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
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
function validTiktokUser(u: string): boolean {
  return /^[a-zA-Z0-9._]{1,30}$/.test(u);
}

/**
 * 영상 데이터셋 → 작성자(크리에이터) 정규화 + 중복제거.
 * authorMeta(또는 author/authorInfo)에서 아이디·팔로워·소개를 뽑는다.
 */
export function creatorsFromTiktok(items: any[]): InstagramCreator[] {
  const out = new Map<string, InstagramCreator>();
  for (const raw of items) {
    const a =
      (raw?.authorMeta as Record<string, any>) ??
      (raw?.author as Record<string, any>) ??
      (raw?.authorInfo as Record<string, any>) ??
      (raw?.user as Record<string, any>) ??
      {};
    const username =
      pickStr(a, ['name', 'uniqueId', 'userName', 'username', 'unique_id']) ??
      pickStr(raw, ['authorName', 'ownerUsername']);
    if (!username || !validTiktokUser(username)) continue;
    const key = username.toLowerCase();
    if (out.has(key)) continue;

    out.set(key, {
      id: `tiktok:${key}`,
      platform: 'tiktok',
      username,
      displayName: pickStr(a, ['nickName', 'nickname', 'fullName', 'displayName']) ?? username,
      profileUrl: `https://www.tiktok.com/@${username}`,
      profileImageUrl: pickStr(a, ['avatar', 'avatarThumb', 'avatarMedium', 'profilePicUrl']),
      biography: pickStr(a, ['signature', 'bio', 'biography', 'desc']),
      followersCount: pickNum(a, ['fans', 'followers', 'followerCount', 'followersCount']),
      followingCount: pickNum(a, ['following', 'followingCount']),
      postsCount: pickNum(a, ['video', 'videoCount', 'videos', 'postsCount']),
      isVerified: Boolean(a?.verified ?? a?.isVerified ?? a?.verification),
      category: null,
      rawData: raw,
    });
  }
  return [...out.values()];
}
/* eslint-enable @typescript-eslint/no-explicit-any */
