import { type NextRequest } from 'next/server';

import { ok, fail, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';
import { getRunStatus, readDataset } from '@/services/apify/instagram';
import { aggregateAndStore, readTrends } from '@/services/trends/audio-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function requireUser() {
  const { createClient } = await import('@/lib/supabase/server');
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user?.id ?? null;
}

/**
 * POST /api/trends/audio/collect { runId, datasetId, scope }
 * 스크랩 런이 끝났으면 데이터셋을 읽어 음원 집계→오늘 스냅샷 저장→최신 랭킹 반환.
 * 아직 돌고 있으면 { done:false }. (클라이언트가 폴링) — 검색과 같은 방식.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isSupabaseConfigured()) return ok({ configured: false, done: true, rows: [] });
  if (!(await requireUser())) return fail('UNAUTHENTICATED', '로그인이 필요합니다.', 401);

  const body = (await request.json().catch(() => ({}))) as {
    runId?: string;
    datasetId?: string;
    scope?: string;
  };
  const { runId, datasetId } = body;
  const scope = (body.scope || '전체').trim();
  if (!runId) return fail('BAD_REQUEST', 'runId가 없습니다.', 400);

  const run = await getRunStatus(runId);
  if (!run) return fail('NOT_FOUND', '스크랩 실행 정보를 찾을 수 없습니다.', 404);

  if (run.status === 'READY' || run.status === 'RUNNING' || run.status === 'ABORTING') {
    return ok({ configured: true, done: false, status: run.status });
  }
  if (run.status !== 'SUCCEEDED') {
    return ok({ configured: true, done: true, failed: true, status: run.status, rows: [] });
  }

  const ds = datasetId ?? run.datasetId;
  if (!ds) return fail('NO_DATASET', '결과 데이터셋을 찾을 수 없습니다.', 502);

  const items = await readDataset(ds);
  await aggregateAndStore(scope, items);
  const { capturedOn, rows } = await readTrends(scope);
  return ok({ configured: true, done: true, scope, capturedOn, rows });
});
