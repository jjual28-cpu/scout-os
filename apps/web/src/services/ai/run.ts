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
    //
    // 무료 Gemini는 큰 호출(실제 판정)에 간헐적으로 503(모델 과부하)을 준다. callOpenRouter가
    // 이미 짧은 백오프로 4회 재시도하지만, 그래도 안 되면 대체 모델로 폴백한다 — 두 모델이
    // 동시에 과부하일 확률은 매우 낮아 사실상 100% 성공(노란 경고 근본 차단). 기본 성공 시엔
    // 추가 호출/지연 없음(첫 모델에서 바로 반환).
    const FALLBACK_MODEL = 'gemini-flash-lite-latest';
    const models = [env.GOOGLE_AI_MODEL, FALLBACK_MODEL].filter(
      (m, i, a) => m && a.indexOf(m) === i,
    );
    let lastErr: unknown;
    for (const model of models) {
      try {
        return await callOpenRouter(googleKey, args, {
          endpoint: GOOGLE_ENDPOINT,
          model,
          jsonFormat: false,
        });
      } catch (err) {
        // 키 없음/한도 초과는 모델을 바꿔도 소용없으니 즉시 중단.
        if (
          err instanceof AppError &&
          (err.code === 'AI_NOT_CONFIGURED' || err.code === 'AI_LIMIT')
        ) {
          throw err;
        }
        lastErr = err; // 과부하/일시 오류 → 다음 모델로 폴백
      }
    }
    throw lastErr;
  }
  return callOpenRouter(key, args);
}
