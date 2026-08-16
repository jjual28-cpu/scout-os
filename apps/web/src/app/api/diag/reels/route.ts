import { NextResponse } from 'next/server';

import { getRunStatus, readDataset, startActorRun } from '@/services/apify/instagram';
import { audioFromReel, reelsAudioInput } from '@/services/apify/reel-audio';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** 임시 진단 — 릴스 스크랩 실데이터 확인(음원 필드 유무). 확인 후 삭제. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const runId = url.searchParams.get('runId');
  if (runId) {
    const run = await getRunStatus(runId);
    if (!run) return NextResponse.json({ error: 'run not found', runId });
    if (run.status !== 'SUCCEEDED') return NextResponse.json({ runId, status: run.status });
    return NextResponse.json(inspect(await readDataset(run.datasetId ?? '')));
  }
  const tags = (url.searchParams.get('tags') || '릴스추천,릴스').split(',').map((t) => t.trim());
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 20, 1), 50);
  const started = await startActorRun(reelsAudioInput(tags, limit));
  const begin = Date.now();
  while (Date.now() - begin < 45_000) {
    await sleep(4000);
    const run = await getRunStatus(started.runId);
    if (!run) break;
    if (run.status === 'SUCCEEDED')
      return NextResponse.json(inspect(await readDataset(run.datasetId ?? started.datasetId)));
    if (run.status !== 'READY' && run.status !== 'RUNNING' && run.status !== 'ABORTING')
      return NextResponse.json({ runId: started.runId, status: run.status });
  }
  return NextResponse.json({ runId: started.runId, status: 'still-running' });
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function inspect(items: any[]) {
  const withMusic = (items ?? []).filter((it) => audioFromReel(it) != null).length;
  const types: Record<string, number> = {};
  for (const it of items ?? []) {
    const t = String(it?.type ?? it?.productType ?? 'unknown');
    types[t] = (types[t] ?? 0) + 1;
  }
  const samples = (items ?? []).slice(0, 4).map((it) => ({
    type: it?.type ?? it?.productType ?? null,
    keys: it && typeof it === 'object' ? Object.keys(it) : [],
    musicInfo: it?.musicInfo ?? it?.music_info ?? it?.music ?? null,
    videoPlayCount: it?.videoPlayCount ?? null,
    videoViewCount: it?.videoViewCount ?? null,
  }));
  return { itemCount: items?.length ?? 0, withMusic, types, samples };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
