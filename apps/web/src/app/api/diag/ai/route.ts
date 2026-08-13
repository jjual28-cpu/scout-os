import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { callOpenRouter, GOOGLE_ENDPOINT } from '@/services/ai/openrouter';

export const dynamic = 'force-dynamic';

/**
 * 임시 진단용 — AI 키/모델이 실제로 동작하는지 확인한다. 키 값은 노출 안 함.
 * googleTest: 진짜 Gemini 호출 1번을 쏴서 OK/FAIL(에러 메시지)을 돌려준다. 원인파악 후 삭제.
 */
export const GET = async () => {
  let googleTest = 'no key';
  if (env.GOOGLE_AI_API_KEY) {
    try {
      const r = await callOpenRouter(
        env.GOOGLE_AI_API_KEY,
        { prompt: '한 단어로만 답하세요: ok', maxTokens: 10, temperature: 0 },
        { endpoint: GOOGLE_ENDPOINT, model: env.GOOGLE_AI_MODEL, jsonFormat: false },
      );
      googleTest = `OK: ${r.slice(0, 60)}`;
    } catch (e) {
      googleTest = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return NextResponse.json({
    googleKey: Boolean(env.GOOGLE_AI_API_KEY),
    googleModel: env.GOOGLE_AI_MODEL,
    openrouterKey: Boolean(env.OPENROUTER_API_KEY),
    aiDailyLimit: env.AI_DAILY_LIMIT,
    googleTest,
  });
};
