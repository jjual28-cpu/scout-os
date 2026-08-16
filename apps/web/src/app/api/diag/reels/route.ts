import { NextResponse } from 'next/server';

import { getRunStatus, readDataset, startActorRun } from '@/services/apify/instagram';
import { audioFromReel, reelsAudioInput } from '@/services/apify/reel-audio';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * 임시 진단 — 릴스를 소량 긁어 "실제로 어떤 필드가 오는지" 그대로 확인한다.
 * 트렌드 음원이 비는 이유(음원 필드 없음/이름 다름/조회수 없음)를 데이터로 잡기 위함.
 * 인증 없음(공개 릴스 데이터라 유저정보 없음). GET ?runId= 로 이어서 조회. 확인 후 삭제.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const runId = url.searchParams.get('runId');

  // 1) 이미 시작된 런 조회 모드.
  if (runId) {
    const run = await getRunStatus(runId);
    if (!run) return NextResponse.json({ error: 'run not found', runId });
    if (run.status !== 'SUCCEEDED') return NextResponse.json({ runId, status: run.status });
    const items = await readDataset(run.datasetId ?? '');
    return NextResponse.json(inspect(items));
  }

  // 2) 새로 소량 스크랩 시작 → ~45초 인라인 폴링 → 되면 바로 분석, 안 되면 runId 반환.
  const started = await startActorRun(reelsAudioInput(['뷰티릴스', '릴스추천'], 20));
  const begin = Date.now();
  while (Date.now() - begin < 45_000) {
    await sleep(5000);
    const run = await getRunStatus(started.runId);
    if (!run) break;
    if (run.status === 'SUCCEEDED') {
      const items = await readDataset(run.datasetId ?? started.datasetId);
      return NextResponse.json(inspect(items));
    }
    if (run.status !== 'READY' && run.status !== 'RUNNING' && run.status !== 'ABORTING') {
      return NextResponse.json({ runId: started.runId, status: run.status, note: 'run failed' });
    }
  }
  return NextResponse.json({
    runId: started.runId,
    status: 'still-running',
    hint: `아직 스크랩 중. 잠시 후 /api/diag/reels?runId=${started.runId} 로 다시 조회.`,
  });
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function inspect(items: any[]) {
  const first = items?.[0] ?? null;
  const withMusic = (items ?? []).filter((it) => audioFromReel(it) != null).length;
  // 앞쪽 아이템들의 음원 관련 후보 필드를 그대로 노출.
  const samples = (items ?? []).slice(0, 3).map((it) => ({
    type: it?.type ?? it?.productType ?? null,
    topKeys: it && typeof it === 'object' ? Object.keys(it).slice(0, 40) : [],
    musicInfo: it?.musicInfo ?? it?.music_info ?? it?.music ?? null,
    videoPlayCount: it?.videoPlayCount ?? null,
    videoViewCount: it?.videoViewCount ?? null,
    extracted: audioFromReel(it),
  }));
  return { itemCount: items?.length ?? 0, withMusic, samples };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
