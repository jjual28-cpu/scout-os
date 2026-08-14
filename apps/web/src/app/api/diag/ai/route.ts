import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { GOOGLE_ENDPOINT, callOpenRouter } from '@/services/ai/openrouter';
import { SYSTEM_CREATOR } from '@/services/ai/query';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * 임시 진단 — planSearch가 단순 키워드에 실제로 어떤 검색어/해시태그/의도를 뽑는지
 * 그대로 본다(bumpUsage 없이 동일 호출 재현). "여행"이 왜 미용실 같은 결과를 내는지
 * AI 계획 품질부터 확인. 확인 끝나면 삭제.
 */
export const GET = async (request: Request) => {
  const googleKey = env.GOOGLE_AI_API_KEY;
  if (!googleKey) return NextResponse.json({ result: 'NO_GOOGLE_KEY' });

  const url = new URL(request.url);
  const queries = (url.searchParams.get('q') || '여행,코스메틱,캠핑')
    .split(',')
    .map((q) => q.trim());

  const out: Record<string, unknown> = {};
  for (const q of queries) {
    try {
      const text = await callOpenRouter(
        googleKey,
        {
          system: SYSTEM_CREATOR,
          prompt: `사용자 요청: "${q}"`,
          json: true,
          maxTokens: 400,
          temperature: 0.3,
        },
        { endpoint: GOOGLE_ENDPOINT, model: env.GOOGLE_AI_MODEL, jsonFormat: false },
      );
      out[q] = { raw: text.slice(0, 400) };
    } catch (err) {
      out[q] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return NextResponse.json(out);
};
