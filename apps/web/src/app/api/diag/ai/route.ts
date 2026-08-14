import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { GOOGLE_ENDPOINT, callOpenRouter } from '@/services/ai/openrouter';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * 임시 진단(측정) — 실제 판정(matchCreators)과 동일한 큰 호출을 여러 번 때려서
 * 재시도가 503(과부하)을 실제로 이기는지 성공률을 잰다. 모델 후보도 함께 시험해
 * 어떤 모델이 안정적인지 확정한다. 확인 끝나면 삭제.
 */
const BIG_PROMPT = `아래 후보들을 브랜드 적합도로 판정해 JSON 배열로만 답하라.
형식: [{"username":"...","score":0-100,"verdict":"fit|maybe|reject","reason":"...","audience":"..."}]

[브랜드] 코스메틱/뷰티 제품을 파는 브랜드. 20~30대 여성 타깃.

[후보 20개]
${Array.from({ length: 20 }, (_, i) => `${i + 1}. @user_${i} · 팔로워 ${1000 * (i + 1)} · 뷰티/일상 크리에이터 · 최근 게시물 활발`).join('\n')}`;

async function tryCall(googleKey: string, model: string) {
  try {
    const text = await callOpenRouter(
      googleKey,
      {
        system: '너는 브랜드-크리에이터 적합도를 판정하는 심사관이다. 반드시 JSON 배열로만 답하라.',
        prompt: BIG_PROMPT,
        json: true,
        maxTokens: 2000,
        temperature: 0.2,
      },
      { endpoint: GOOGLE_ENDPOINT, model, jsonFormat: false },
    );
    return { ok: true, len: text.length };
  } catch (err) {
    return { ok: false, err: err instanceof Error ? err.message : String(err) };
  }
}

export const GET = async (request: Request) => {
  const googleKey = env.GOOGLE_AI_API_KEY;
  const out: Record<string, unknown> = { currentModel: env.GOOGLE_AI_MODEL };
  if (!googleKey) {
    out.result = 'NO_GOOGLE_KEY';
    return NextResponse.json(out);
  }

  const url = new URL(request.url);
  const modelsParam = url.searchParams.get('models');
  const models = modelsParam
    ? modelsParam
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
    : [env.GOOGLE_AI_MODEL, 'gemini-flash-lite-latest'];

  // 각 모델을 4회씩 큰 호출(재시도 내장) → OK/FAIL 카운트 + 실패 샘플.
  const results: Record<string, unknown> = {};
  for (const model of models) {
    let ok = 0;
    const errs: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await tryCall(googleKey, model);
      if (r.ok) ok++;
      else errs.push(String(r.err));
    }
    results[model] = { ok, fail: 4 - ok, errSample: errs.slice(0, 2) };
  }
  out.results = results;
  return NextResponse.json(out);
};
