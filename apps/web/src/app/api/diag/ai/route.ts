import { NextResponse } from 'next/server';

import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * 임시 진단용 — AI 키/모델이 런타임에 실제로 읽히는지 boolean 으로만 확인한다.
 * (키 값은 절대 노출하지 않음.) 원인 파악 후 삭제 예정.
 */
export const GET = () =>
  NextResponse.json({
    googleKey: Boolean(env.GOOGLE_AI_API_KEY),
    googleModel: env.GOOGLE_AI_MODEL,
    openrouterKey: Boolean(env.OPENROUTER_API_KEY),
    openrouterModel: env.OPENROUTER_MODEL,
    aiDailyLimit: env.AI_DAILY_LIMIT,
  });
