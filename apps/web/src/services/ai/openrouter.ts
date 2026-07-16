import 'server-only';

import { AppError } from '@/lib/api/response';
import { env } from '@/lib/env';

/**
 * OpenRouter adapter. Scout OS calls OpenRouter with ONE platform key (the
 * operator's, billed to their OpenRouter balance) on behalf of every user. The
 * key stays server-side, is passed only in the Authorization header (never a
 * URL), and is never logged. One key reaches many models (Gemini / GPT / Claude
 * / DeepSeek), so the default model can change without touching this code.
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

type GenArgs = {
  system?: string;
  prompt: string;
  model?: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- OpenRouter JSON is untyped external data */

/** Call OpenRouter chat completions and return the text. Throws AppError on failure. */
export async function callOpenRouter(apiKey: string, args: GenArgs): Promise<string> {
  const messages: { role: 'system' | 'user'; content: string }[] = [];
  if (args.system) messages.push({ role: 'system', content: args.system });
  messages.push({ role: 'user', content: args.prompt });

  const body: Record<string, unknown> = {
    model: args.model || env.OPENROUTER_MODEL,
    messages,
    max_tokens: args.maxTokens ?? 1024,
    temperature: args.temperature ?? 0.7,
    ...(args.json ? { response_format: { type: 'json_object' } } : {}),
  };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Optional attribution — helps on the OpenRouter dashboard.
        'HTTP-Referer': env.NEXT_PUBLIC_APP_URL,
        'X-Title': env.NEXT_PUBLIC_APP_NAME,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AppError('AI_NETWORK', 'AI 서버에 연결하지 못했습니다.', 502);
  }

  if (!res.ok) {
    // The response BODY never contains the key (it's only in the request header),
    // so surfacing OpenRouter's own message is safe and helps diagnose bad model
    // slugs or empty balance.
    const detail = await res
      .json()
      .then((j: any) => (typeof j?.error?.message === 'string' ? j.error.message : ''))
      .catch(() => '');
    const msg =
      res.status === 401 || res.status === 403
        ? 'AI 키가 올바르지 않습니다. 관리자에게 문의하세요.'
        : res.status === 402
          ? 'AI 크레딧이 부족합니다. 관리자의 OpenRouter 충전이 필요합니다.'
          : res.status === 404
            ? `AI 모델 설정을 확인해 주세요. (${detail || '모델을 찾을 수 없음'})`
            : res.status === 429
              ? 'AI 요청이 잠시 몰렸습니다. 잠시 후 다시 시도해 주세요.'
              : `AI 오류가 발생했습니다. (${res.status}${detail ? ` · ${detail}` : ''})`;
    throw new AppError('AI_ERROR', msg, 502);
  }

  const json = (await res.json().catch(() => null)) as any;
  const content = json?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : '';
}

/* eslint-enable @typescript-eslint/no-explicit-any */
