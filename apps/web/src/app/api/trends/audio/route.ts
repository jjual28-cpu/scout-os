import { type NextRequest } from 'next/server';

import { ok, fail, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';
import { startActorRun } from '@/services/apify/instagram';
import { reelsAudioInput } from '@/services/apify/reel-audio';
import { readTrends, tagsForScope } from '@/services/trends/audio-service';

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
 * GET /api/trends/audio?scope=뷰티 — 저장된 최신 릴스 트렌드 음원 랭킹(급상승 포함).
 * 스크랩은 하지 않고 DB(스냅샷)만 읽는다(빠름). 데이터가 없으면 빈 배열.
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  if (!isSupabaseConfigured()) return ok({ configured: false, capturedOn: null, rows: [] });
  if (!(await requireUser())) return fail('UNAUTHENTICATED', '로그인이 필요합니다.', 401);

  const scope = (request.nextUrl.searchParams.get('scope') || '전체').trim();
  const { capturedOn, rows } = await readTrends(scope);
  return ok({ configured: true, scope, capturedOn, rows });
});

/**
 * POST /api/trends/audio { scope } — 이 분야의 릴스 스크랩을 시작한다(음원 집계용).
 * ~1초 내 runId 반환(스크랩 완료는 안 기다림). 완료 수집은 /collect 가 담당.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isSupabaseConfigured()) return ok({ configured: false });
  if (!(await requireUser())) return fail('UNAUTHENTICATED', '로그인이 필요합니다.', 401);

  const body = (await request.json().catch(() => ({}))) as { scope?: string };
  const scope = (body.scope || '전체').trim();
  const started = await startActorRun(reelsAudioInput(tagsForScope(scope)));
  return ok({ configured: true, scope, runId: started.runId, datasetId: started.datasetId });
});
