import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { callOpenRouter, GOOGLE_ENDPOINT } from '@/services/ai/openrouter';

export const dynamic = 'force-dynamic';

/**
 * 임시 진단용 — 어떤 Gemini 모델명이 실제로 동작하는지 여러 개 테스트한다.
 * 키 값은 노출 안 함. 원인파악(정확한 모델명) 후 삭제.
 */
const CANDIDATES = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-latest',
  'gemini-2.0-flash-001',
];

export const GET = async () => {
  const modelTests: Record<string, string> = {};
  if (env.GOOGLE_AI_API_KEY) {
    for (const m of CANDIDATES) {
      try {
        const r = await callOpenRouter(
          env.GOOGLE_AI_API_KEY,
          { prompt: 'ok', maxTokens: 5, temperature: 0 },
          { endpoint: GOOGLE_ENDPOINT, model: m, jsonFormat: false },
        );
        modelTests[m] = `OK: ${r.slice(0, 20)}`;
      } catch (e) {
        modelTests[m] = `FAIL: ${(e instanceof Error ? e.message : String(e)).slice(0, 60)}`;
      }
    }
  }
  return NextResponse.json({
    googleKey: Boolean(env.GOOGLE_AI_API_KEY),
    currentModel: env.GOOGLE_AI_MODEL,
    modelTests,
  });
};
