import { type NextRequest } from 'next/server';

import { env } from '@/lib/env';
import { getRunStatus, readDataset, startActorRun } from '@/services/apify/instagram';
import { reelsAudioInput } from '@/services/apify/reel-audio';
import { aggregateAndStore, tagsForScope } from '@/services/trends/audio-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** 매일 스냅샷을 쌓을 분야들. 이게 쌓여야 '급상승(뜨는 중)'을 며칠 대비로 계산 가능. */
const TRACKED_SCOPES = ['전체', '뷰티', '패션', '여행', '맛집'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 한 런을 완료까지 폴링(최대 maxMs)해 데이터셋 아이템을 반환. 실패/타임아웃이면 []. */
async function pollAndRead(runId: string, datasetId: string, maxMs = 210_000): Promise<unknown[]> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const run = await getRunStatus(runId);
    if (!run) return [];
    if (run.status === 'SUCCEEDED') return readDataset(run.datasetId ?? datasetId);
    if (run.status !== 'READY' && run.status !== 'RUNNING' && run.status !== 'ABORTING') return [];
    await sleep(5000);
  }
  return [];
}

/**
 * GET /api/cron/audio-snapshot — 매일(18시 UTC) 트래킹 분야의 릴스를 긁어 음원 트렌드
 * 스냅샷을 저장한다. 여러 분야를 병렬로 긁고(벽시계 ≈ 가장 느린 1건), 각각 집계·저장.
 * CRON_SECRET Bearer로 보호(Vercel Cron이 자동으로 붙임).
 */
export const GET = async (request: NextRequest) => {
  const secret = env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const results = await Promise.all(
    TRACKED_SCOPES.map(async (scope) => {
      try {
        const started = await startActorRun(reelsAudioInput(tagsForScope(scope)));
        const items = await pollAndRead(started.runId, started.datasetId);
        const aggs = await aggregateAndStore(scope, items);
        return { scope, reels: items.length, audios: aggs.length };
      } catch (err) {
        console.error(`[cron/audio-snapshot] ${scope} failed: ${String(err)}`);
        return { scope, error: String(err) };
      }
    }),
  );

  return Response.json({ ok: true, results });
};
