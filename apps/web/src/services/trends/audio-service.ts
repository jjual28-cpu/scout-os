import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

import { aggregateAudio, type AudioAggregate } from '../apify/reel-audio';

/* eslint-disable @typescript-eslint/no-explicit-any -- DB 행/Apify 아이템은 비정형 */

/** 분야(scope) → 릴스를 긁을 해시태그. AI 없이 규칙기반(가볍게). '전체'는 범용 릴스 태그. */
export function tagsForScope(scope: string): string[] {
  const base = scope.replace(/[#\s]+/g, '');
  if (!base || base === '전체' || base.toLowerCase() === 'all') {
    return ['릴스추천', '릴스', '릴스스타그램', '오늘의릴스', '릴스탐험'];
  }
  return [base, `${base}스타그램`, `${base}추천`, `${base}릴스`, '릴스추천'];
}

/** 오늘 날짜(UTC) YYYY-MM-DD. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 랭킹 1건(저장·조회 공용) + 급상승 지표. */
export type AudioTrendRow = AudioAggregate & {
  /** 이전 스냅샷 대비 사용 증가율(%). 이전에 없던 신규면 null(‘신규’로 표기). */
  risePct: number | null;
  isNew: boolean;
};

/**
 * 긁은 릴스 게시물 배열을 음원별로 집계해 오늘 스냅샷으로 저장(upsert)한다.
 * 서비스롤로 기록(RLS 우회). 저장된 집계를 반환.
 */
export async function aggregateAndStore(scope: string, items: any[]): Promise<AudioAggregate[]> {
  const aggregates = aggregateAudio(items)
    .sort((a, b) => b.reelCount - a.reelCount || b.maxViews - a.maxViews)
    .slice(0, 100); // 상위 100 음원만 저장

  if (aggregates.length === 0) return [];

  const admin = createAdminClient();
  const captured_on = today();
  const rows = aggregates.map((a) => ({
    captured_on,
    scope,
    audio_key: a.audioKey,
    audio_id: a.audioId,
    song_name: a.songName,
    artist_name: a.artistName,
    uses_original: a.usesOriginal,
    reel_count: a.reelCount,
    total_views: a.totalViews,
    max_views: a.maxViews,
    avg_views: a.avgViews,
    sample_reels: a.sampleReels,
  }));
  const { error } = await admin
    .from('reel_audio_snapshots')
    .upsert(rows, { onConflict: 'captured_on,scope,audio_key' });
  if (error) console.error(`[trends/audio] snapshot upsert failed (${scope}): ${error.message}`);
  return aggregates;
}

/** 스냅샷 행 → AudioAggregate 형태로 되살린다. */
function rowToAgg(r: Record<string, any>): AudioAggregate {
  return {
    audioKey: r.audio_key,
    audioId: r.audio_id ?? null,
    songName: r.song_name ?? null,
    artistName: r.artist_name ?? null,
    usesOriginal: Boolean(r.uses_original),
    reelCount: Number(r.reel_count ?? 0),
    totalViews: Number(r.total_views ?? 0),
    maxViews: Number(r.max_views ?? 0),
    avgViews: Number(r.avg_views ?? 0),
    sampleReels: Array.isArray(r.sample_reels) ? r.sample_reels : [],
  };
}

/**
 * 저장된 스냅샷에서 이 분야의 최신 랭킹을 읽고, 이전 스냅샷과 비교해 급상승(%)을
 * 계산한다. (v1=많이쓴·고조회는 최신 스냅샷만으로, v2=급상승은 이전 대비 증가율.)
 */
export async function readTrends(scope: string): Promise<{
  capturedOn: string | null;
  rows: AudioTrendRow[];
}> {
  const admin = createAdminClient();

  // 최신 스냅샷 날짜.
  const { data: latestDay } = await admin
    .from('reel_audio_snapshots')
    .select('captured_on')
    .eq('scope', scope)
    .order('captured_on', { ascending: false })
    .limit(1);
  const capturedOn: string | null = (latestDay as any[] | null)?.[0]?.captured_on ?? null;
  if (!capturedOn) return { capturedOn: null, rows: [] };

  // 최신 스냅샷 전체.
  const { data: latest } = await admin
    .from('reel_audio_snapshots')
    .select('*')
    .eq('scope', scope)
    .eq('captured_on', capturedOn);

  // 비교 기준 = 최신보다 이전인 가장 가까운 스냅샷(급상승 계산용).
  const { data: prevDay } = await admin
    .from('reel_audio_snapshots')
    .select('captured_on')
    .eq('scope', scope)
    .lt('captured_on', capturedOn)
    .order('captured_on', { ascending: false })
    .limit(1);
  const prevOn: string | null = (prevDay as any[] | null)?.[0]?.captured_on ?? null;

  const prevCount = new Map<string, number>();
  if (prevOn) {
    const { data: prev } = await admin
      .from('reel_audio_snapshots')
      .select('audio_key,reel_count')
      .eq('scope', scope)
      .eq('captured_on', prevOn);
    for (const r of (prev as any[] | null) ?? [])
      prevCount.set(r.audio_key, Number(r.reel_count ?? 0));
  }

  const rows: AudioTrendRow[] = ((latest as any[] | null) ?? []).map((r) => {
    const agg = rowToAgg(r);
    const before = prevCount.get(agg.audioKey);
    const isNew = prevOn != null && before == null;
    const risePct =
      before && before > 0 ? Math.round(((agg.reelCount - before) / before) * 100) : null;
    return { ...agg, risePct, isNew };
  });

  return { capturedOn, rows };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
