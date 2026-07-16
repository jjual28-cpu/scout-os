import 'server-only';

import { AppError } from '@/lib/api/response';
import { env } from '@/lib/env';

import { callOpenRouter } from './openrouter';
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
};

export async function runAi(userId: string, args: RunAiArgs): Promise<string> {
  const key = env.OPENROUTER_API_KEY;
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

  return callOpenRouter(key, args);
}
