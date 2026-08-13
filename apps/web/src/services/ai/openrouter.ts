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
/** Google AI Studio(Gemini)의 OpenAI 호환 엔드포인트 — 무료 티어로 같은 코드로 호출. */
export const GOOGLE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

type GenArgs = {
  system?: string;
  prompt: string;
  model?: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Image URLs for a vision call. When present, the user message is multimodal. */
  images?: string[];
};

/** 프로바이더 선택(OpenRouter 기본 / Google 등). 없으면 OpenRouter로 동작(기존 그대로). */
export type CallOpts = {
  /** 요청 엔드포인트. 미지정 시 OpenRouter. */
  endpoint?: string;
  /** 모델 강제 지정(있으면 args.model·기본모델보다 우선 — Google 슬러그 대응). */
  model?: string;
  /** response_format(json_object) 전송 여부. Google 호환 이슈 대비 끌 수 있음. */
  jsonFormat?: boolean;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- OpenRouter JSON is untyped external data */

type TextPart = { type: 'text'; text: string };
type ImagePart = { type: 'image_url'; image_url: { url: string } };
type UserContent = string | (TextPart | ImagePart)[];

/** Call a chat-completions endpoint (OpenRouter 기본, opts로 Google 등 전환) and return the text. */
export async function callOpenRouter(
  apiKey: string,
  args: GenArgs,
  opts?: CallOpts,
): Promise<string> {
  const messages: { role: 'system' | 'user'; content: UserContent }[] = [];
  if (args.system) messages.push({ role: 'system', content: args.system });

  // Vision: OpenRouter/OpenAI multimodal content = [text, image_url...]. Plain
  // text calls keep the simple string content (unchanged behaviour).
  const imgs = (args.images ?? []).filter((u) => typeof u === 'string' && u.trim());
  if (imgs.length > 0) {
    const content: (TextPart | ImagePart)[] = [{ type: 'text', text: args.prompt }];
    for (const url of imgs) content.push({ type: 'image_url', image_url: { url } });
    messages.push({ role: 'user', content });
  } else {
    messages.push({ role: 'user', content: args.prompt });
  }

  const sendJsonFormat = args.json && (opts?.jsonFormat ?? true);
  const body: Record<string, unknown> = {
    // opts.model(강제) > args.model > 기본. Google 사용 시 opts.model 로 gemini 슬러그를 넣는다.
    model: opts?.model || args.model || env.OPENROUTER_MODEL,
    messages,
    max_tokens: args.maxTokens ?? 1024,
    temperature: args.temperature ?? 0.7,
    ...(sendJsonFormat ? { response_format: { type: 'json_object' } } : {}),
  };

  let res: Response;
  try {
    res = await fetch(opts?.endpoint ?? ENDPOINT, {
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
