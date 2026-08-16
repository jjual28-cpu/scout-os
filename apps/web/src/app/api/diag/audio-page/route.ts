import { NextResponse } from 'next/server';

import { getRunStatus, readDataset, startActorRun } from '@/services/apify/instagram';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * 임시 진단 — Apify 액터가 인스타 "음원 페이지"(/reels/audio/{id})를 긁을 수 있는지,
 * 긁으면 무엇이 오는지(전체 사용 릴스 수·인기 릴스) 확인. 음원 페이지 역추적 가능성 검증.
 * ?id=963162233322082  또는 ?url=<full audio url>. 확인 후 삭제.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const runId = url.searchParams.get('runId');
  if (runId) {
    const run = await getRunStatus(runId);
    if (!run) return NextResponse.json({ error: 'run not found' });
    if (run.status !== 'SUCCEEDED') return NextResponse.json({ runId, status: run.status });
    return NextResponse.json(inspect(await readDataset(run.datasetId ?? '')));
  }

  const id = url.searchParams.get('id') || '963162233322082';
  const direct = url.searchParams.get('url') || `https://www.instagram.com/reels/audio/${id}/`;
  const input = { directUrls: [direct], resultsType: 'posts', resultsLimit: 20 };
  const started = await startActorRun(input);
  const begin = Date.now();
  while (Date.now() - begin < 45_000) {
    await sleep(4000);
    const run = await getRunStatus(started.runId);
    if (!run) break;
    if (run.status === 'SUCCEEDED')
      return NextResponse.json({
        scrapedUrl: direct,
        ...inspect(await readDataset(run.datasetId ?? started.datasetId)),
      });
    if (run.status !== 'READY' && run.status !== 'RUNNING' && run.status !== 'ABORTING')
      return NextResponse.json({ scrapedUrl: direct, runId: started.runId, status: run.status });
  }
  return NextResponse.json({ scrapedUrl: direct, runId: started.runId, status: 'still-running' });
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function inspect(items: any[]) {
  const types: Record<string, number> = {};
  for (const it of items ?? []) {
    const t = String(it?.type ?? it?.productType ?? 'unknown');
    types[t] = (types[t] ?? 0) + 1;
  }
  const first = items?.[0] ?? null;
  return {
    itemCount: items?.length ?? 0,
    types,
    firstKeys: first && typeof first === 'object' ? Object.keys(first) : [],
    // 음원 페이지 전체 사용수 후보 필드들
    firstSample: first
      ? {
          type: first.type ?? first.productType ?? null,
          videoPlayCount: first.videoPlayCount ?? null,
          likesCount: first.likesCount ?? null,
          musicInfo: first.musicInfo ?? null,
          url: first.url ?? null,
        }
      : null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
