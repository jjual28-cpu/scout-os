import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { GOOGLE_ENDPOINT, callOpenRouter } from '@/services/ai/openrouter';

export const dynamic = 'force-dynamic';

/**
 * 임시 진단 — 실제 검색의 AI 판정(matchCreators)이 쓰는 것과 똑같은 호출
 * (json:true, maxTokens:2000, Google 엔드포인트)을 재현해 실제 상태코드·에러메시지를
 * 그대로 확인한다. 작은 핑은 되는데 큰 판정 호출이 왜 실패하는지 잡기 위함.
 * 키 값은 노출하지 않는다. 확인 끝나면 삭제.
 */
const BIG_PROMPT = `아래 후보들을 브랜드 적합도로 판정해 JSON 배열로만 답하라.
형식: [{"username":"...","score":0-100,"verdict":"fit|maybe|reject","reason":"...","audience":"..."}]

[브랜드] 코스메틱/뷰티 제품을 파는 브랜드. 20~30대 여성 타깃.

[후보 12개]
${Array.from({ length: 12 }, (_, i) => `${i + 1}. @user_${i} · 팔로워 ${1000 * (i + 1)} · 뷰티/일상 크리에이터 · 최근 게시물 활발`).join('\n')}`;

export const GET = async () => {
  const googleKey = env.GOOGLE_AI_API_KEY;
  const out: Record<string, unknown> = {
    hasGoogleKey: Boolean(googleKey),
    googleModel: env.GOOGLE_AI_MODEL,
  };
  if (!googleKey) {
    out.result = 'NO_GOOGLE_KEY';
    return NextResponse.json(out);
  }

  // 1) 실제 match와 동일한 큰 호출(json:true, maxTokens:2000)
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
      { endpoint: GOOGLE_ENDPOINT, model: env.GOOGLE_AI_MODEL, jsonFormat: false },
    );
    out.matchCall = 'OK';
    out.replyLength = text.length;
    out.replySnippet = text.slice(0, 200);
  } catch (err) {
    out.matchCall = 'FAIL';
    out.matchError = err instanceof Error ? err.message : String(err);
    out.matchCode = (err as { code?: string })?.code ?? null;
  }
  return NextResponse.json(out);
};
