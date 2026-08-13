import 'server-only';

import { AppError } from '@/lib/api/response';
import { env } from '@/lib/env';

import { callOpenRouter, GOOGLE_ENDPOINT } from './openrouter';
import { bumpUsage } from './usage';

/**
 * The single entry point every AI feature (analysis, DM drafts, reports) calls.
 *
 * Enforces, in order:
 *   1. platform key is configured (operator set OPENROUTER_API_KEY),
 *   2. the user is under their daily cap (AI_DAILY_LIMIT) — counted BEFORE the
 *      call so a burst can't overspend the shared balance,
 *   3. then runs the model.
 *
 * Never called from the creator-search path — search stays AI-free (Apify only).
 */
export type RunAiArgs = {
  system?: string;
  prompt: string;
  model?: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Image URLs for a vision call (multimodal). Needs a vision-capable model. */
  images?: string[];
};

export async function runAi(userId: string, args: RunAiArgs): Promise<string> {
  // Google(무료) 키가 있으면 그걸 우선 사용, 없으면 OpenRouter. 둘 다 없으면 미설정.
  const googleKey = env.GOOGLE_AI_API_KEY;
  const key = googleKey ?? env.OPENROUTER_API_KEY;
  if (!key) {
    throw new AppError('AI_NOT_CONFIGURED', 'AI가 아직 설정되지 않았습니다.', 503);
  }

  const count = await bumpUsage(userId, env.AI_DAILY_LIMIT);
  if (count < 0) {
    throw new AppError(
      'AI_LIMIT',
      `오늘 AI 사용 한도(${env.AI_DAILY_LIMIT}회)를 모두 사용했습니다. 내일 다시 시도해 주세요.`,
      429,
    );
  }

  if (googleKey) {
    // Google Gemini(OpenAI 호환). 모델은 gemini 슬러그로 강제, response_format은 호환
    // 이슈 대비 끄고(파서가 코드펜스 JSON도 흡수) 안전하게 호출.
    return callOpenRouter(googleKey, args, {
      endpoint: GOOGLE_ENDPOINT,
      model: env.GOOGLE_AI_MODEL,
      jsonFormat: false,
    });
  }
  return callOpenRouter(key, args);
}
