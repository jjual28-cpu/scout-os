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

  // Gemini 2.5 계열(gemini-flash-latest 등)은 기본적으로 'thinking'(내부 추론)을 켜서 응답
  // 토큰 예산을 추론에 먼저 쓴다. 셀럽 판정 같은 큰 호출에선 추론이 max_tokens를 다 먹어
  // 실제 JSON 출력이 잘리거나 비어버리고(→파싱 실패→판정 전무→원본 무필터 노출), 이게
  // "여자 검색에 남자가 뜨는" 근본 원인이었다. 분류·판정에는 추론이 불필요하니 끈다.
  // (Google OpenAI 호환 파라미터. 미지원 모델은 무시하거나 재시도/폴백이 흡수.)
  if (opts?.endpoint === GOOGLE_ENDPOINT) {
    body.reasoning_effort = 'none';
  }

  // 무료 Gemini는 과부하 시 503(간헐적)을 자주 준다 — 실제 판정처럼 큰 호출일수록 더.
  // 일시적 상태(429 한도/500·502·503·504 과부하)는 짧은 백오프로 재시도하면 대개 성공한다.
  const RETRY_STATUS = new Set([429, 500, 502, 503, 504, 529]);
  const MAX_ATTEMPTS = 4;
  const PER_ATTEMPT_MS = 12_000; // 한 번의 호출이 이 이상 매달리면 중단(라우트 60초 정지 방지)
  const DEADLINE = Date.now() + 26_000; // 전체 예산 — 재시도 다 합쳐도 이 안에서 끝낸다
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  let res: Response | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (Date.now() > DEADLINE) break;
    // 응답이 안 오고 매달리는(hang) 경우까지 잡으려면 fetch 자체에 타임아웃이 필요하다.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PER_ATTEMPT_MS);
    try {
      res = await fetch(opts?.endpoint ?? ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': env.NEXT_PUBLIC_APP_URL,
          'X-Title': env.NEXT_PUBLIC_APP_NAME,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch {
      // 타임아웃(abort)·네트워크 실패 — 예산 남았으면 재시도, 아니면 포기.
      if (attempt < MAX_ATTEMPTS && Date.now() < DEADLINE) {
        await sleep(600 * attempt);
        continue;
      }
      throw new AppError('AI_NETWORK', 'AI 서버에 연결하지 못했습니다.', 502);
    } finally {
      clearTimeout(timer);
    }
    // 과부하·한도 → 백오프 후 재시도.
    if (RETRY_STATUS.has(res.status) && attempt < MAX_ATTEMPTS && Date.now() < DEADLINE) {
      await sleep(800 * attempt);
      continue;
    }
    break;
  }
  if (!res) throw new AppError('AI_NETWORK', 'AI 서버에 연결하지 못했습니다.', 502);

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
  const choice = json?.choices?.[0];
  const content = choice?.message?.content;
  const text = typeof content === 'string' ? content : '';
  if (!text.trim()) {
    // 200 OK인데 본문이 빔 — thinking 모델이 추론에 토큰을 다 쓰거나(finish_reason=length)
    // 안전필터가 출력을 막을 때 Gemini가 이렇게 준다. 예전엔 ''를 그대로 돌려줘 호출부가
    // "판정 없음"으로 오인해 원본을 필터 없이 노출했다. 던져서 run.ts가 대체 모델로 폴백하고
    // 그래도 실패하면 호출부가 ai_error를 남기게 한다(조용한 실패 차단).
    const fr = choice?.finish_reason ?? 'unknown';
    console.warn(`[ai] empty content (model=${opts?.model || body.model}, finish_reason=${fr})`);
    throw new AppError('AI_EMPTY', `AI가 빈 응답을 반환했습니다. (${fr})`, 502);
  }
  return text;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
