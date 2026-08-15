import 'server-only';

/**
 * 릴스 트렌드 음원 — 인스타 릴스(게시물) 데이터에서 음원 정보를 뽑아 집계한다.
 *
 * 방식은 셀럽 검색과 동일: Apify로 해시태그의 최근 게시물(릴스 포함)을 긁으면, 각
 * 릴스에 `musicInfo`(곡명·아티스트·오디오ID·오리지널여부)와 조회수가 같이 온다. 그걸
 * 음원별로 모아 "가장 많이 쓴 / 고조회 릴스에 쓰인" 음원을 랭킹한다. (공식 트렌드 차트가
 * 아니라 우리가 긁은 릴스 표본 기반 추정 — 표본이 클수록 정확.)
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Apify 게시물 JSON은 외부 비정형 데이터 */

/** 릴스 하나에서 뽑은 음원 + 조회수. */
export type ReelAudio = {
  audioKey: string; // 집계 키 — audioId 있으면 그것, 없으면 곡명|아티스트
  audioId: string | null;
  songName: string | null;
  artistName: string | null;
  usesOriginal: boolean;
  views: number;
  reelUrl: string | null;
  ownerUsername: string | null;
};

/** 음원별 집계 결과(랭킹 단위). */
export type AudioAggregate = {
  audioKey: string;
  audioId: string | null;
  songName: string | null;
  artistName: string | null;
  usesOriginal: boolean;
  reelCount: number; // 이 음원을 쓴 릴스 수(= 많이 쓴 지표)
  totalViews: number; // 그 릴스들의 총 조회수
  maxViews: number; // 최고 조회수(= 고조회 지표)
  avgViews: number;
  sampleReels: { url: string; views: number; owner: string | null }[]; // 대표 릴스 상위 몇 개
};

function str(o: Record<string, any>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}
function num(o: Record<string, any>, keys: string[]): number {
  for (const k of keys) {
    const n = Number(o?.[k]);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

/** 게시물의 조회수(릴스는 재생수). 여러 필드명 방어. */
function reelViews(post: Record<string, any>): number {
  return num(post, [
    'videoPlayCount',
    'videoViewCount',
    'playCount',
    'viewsCount',
    'videoViewsCount',
    'views',
  ]);
}

/**
 * 게시물 1개 → 음원 정보. 릴스가 아니거나(음원 없음) 음원 메타가 비면 null.
 * Apify instagram-scraper의 릴스 출력은 `musicInfo`{song_name,artist_name,audio_id,
 * uses_original_audio}를 담는다. 실필드명은 배포 후 실데이터로 확정(다중키 방어).
 */
export function audioFromReel(post: any): ReelAudio | null {
  if (!post || typeof post !== 'object') return null;
  const p = post as Record<string, any>;
  const mi = (p.musicInfo ??
    p.music_info ??
    p.music ??
    p.clips_music_attribution_info ??
    {}) as Record<string, any>;

  const audioId = str(mi, ['audio_id', 'audioId', 'id', 'audio_cluster_id', 'music_canonical_id']);
  const songName = str(mi, ['song_name', 'songName', 'title', 'music_asset_title']);
  const artistName = str(mi, [
    'artist_name',
    'artistName',
    'artist',
    'display_artist',
    'ig_artist_username',
  ]);
  const usesOriginal = Boolean(mi.uses_original_audio ?? mi.usesOriginalAudio ?? false);

  // 음원 식별 불가(곡명·아이디 모두 없음) → 트렌드 집계에 못 씀.
  if (!audioId && !songName) return null;

  const audioKey = audioId || `${songName ?? ''}|${artistName ?? ''}`.toLowerCase();
  const owner =
    str(p, ['ownerUsername']) ?? str((p.owner as Record<string, any>) ?? {}, ['username']);
  const shortCode = str(p, ['shortCode', 'shortcode']);
  const reelUrl =
    str(p, ['url']) ?? (shortCode ? `https://www.instagram.com/reel/${shortCode}/` : null);

  return {
    audioKey,
    audioId: audioId || null,
    songName,
    artistName,
    usesOriginal,
    views: reelViews(p),
    reelUrl,
    ownerUsername: owner,
  };
}

/** 게시물 배열 → 음원별 집계(랭킹). reelCount·조회수로 정렬은 호출측에서. */
export function aggregateAudio(items: any[]): AudioAggregate[] {
  const map = new Map<string, AudioAggregate & { _reels: ReelAudio[] }>();
  for (const raw of items ?? []) {
    const a = audioFromReel(raw);
    if (!a) continue;
    let agg = map.get(a.audioKey);
    if (!agg) {
      agg = {
        audioKey: a.audioKey,
        audioId: a.audioId,
        songName: a.songName,
        artistName: a.artistName,
        usesOriginal: a.usesOriginal,
        reelCount: 0,
        totalViews: 0,
        maxViews: 0,
        avgViews: 0,
        sampleReels: [],
        _reels: [],
      };
      map.set(a.audioKey, agg);
    }
    // 곡명/아티스트는 처음 본 값 유지하되, 비어있던 걸 나중에 채운다.
    agg.songName = agg.songName ?? a.songName;
    agg.artistName = agg.artistName ?? a.artistName;
    agg.reelCount += 1;
    agg.totalViews += a.views;
    if (a.views > agg.maxViews) agg.maxViews = a.views;
    agg._reels.push(a);
  }

  const out: AudioAggregate[] = [];
  for (const agg of map.values()) {
    agg.avgViews = agg.reelCount > 0 ? Math.round(agg.totalViews / agg.reelCount) : 0;
    agg.sampleReels = agg._reels
      .filter((r) => r.reelUrl)
      .sort((a, b) => b.views - a.views)
      .slice(0, 3)
      .map((r) => ({ url: r.reelUrl as string, views: r.views, owner: r.ownerUsername }));
    const { _reels, ...clean } = agg;
    void _reels;
    out.push(clean);
  }
  return out;
}

/**
 * 릴스 트렌드용 Apify 입력 — 해시태그의 최근 게시물(릴스 포함)을 많이 긁는다.
 * 셀럽 검색의 stage2(30개)보다 크게(음원 트렌드는 표본이 커야 정확).
 */
export function reelsAudioInput(tags: string[], limit = 120) {
  const clean = tags
    .map((t) => t.replace(/[#\s]+/g, ''))
    .filter(Boolean)
    .slice(0, 6);
  return {
    directUrls: clean.map(
      (t) => `https://www.instagram.com/explore/tags/${encodeURIComponent(t)}/`,
    ),
    resultsType: 'posts',
    resultsLimit: Math.min(Math.max(limit, 1), 200),
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
