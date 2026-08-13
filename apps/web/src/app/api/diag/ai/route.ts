import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { GOOGLE_ENDPOINT, callOpenRouter } from '@/services/ai/openrouter';

export const dynamic = 'force-dynamic';

/**
 * 임시 진단 — 프로덕션에서 Google AI(무료 Gemini)가 실제로 되는지, 어떤 모델명이
 * 걸려 있는지 그대로 확인한다. 키 값은 절대 노출하지 않고 존재 여부(boolean)만 뱉는다.
 * 확인 끝나면 삭제한다. (usage 카운트/유저 문맥 없이 모델만 직접 찌른다.)
 */
export const GET = async () => {
  const googleKey = env.GOOGLE_AI_API_KEY;
  const out: Record<string, unknown> = {
    hasGoogleKey: Boolean(googleKey),
    hasOpenrouterKey: Boolean(env.OPENROUTER_API_KEY),
    googleModel: env.GOOGLE_AI_MODEL,
    openrouterModel: env.OPENROUTER_MODEL,
  };

  const key = googleKey ?? env.OPENROUTER_API_KEY;
  if (!key) {
    out.result = 'NO_KEY';
    return NextResponse.json(out);
  }

  try {
    const text = googleKey
      ? await callOpenRouter(
          googleKey,
          { prompt: 'ping. reply with the single word: pong', maxTokens: 10 },
          { endpoint: GOOGLE_ENDPOINT, model: env.GOOGLE_AI_MODEL, jsonFormat: false },
        )
      : await callOpenRouter(key, {
          prompt: 'ping. reply with the single word: pong',
          maxTokens: 10,
        });
    out.result = 'OK';
    out.reply = text.slice(0, 80);
  } catch (err) {
    out.result = 'FAIL';
    out.error = err instanceof Error ? err.message : String(err);
    out.code = (err as { code?: string })?.code ?? null;
  }
  return NextResponse.json(out);
};
