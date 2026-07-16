import 'server-only';

import { AppError } from '@/lib/api/response';

/**
 * Google Gemini adapter (BYO key). Scout OS never ships its own AI key — the AI
 * cost is billed to the user's own Gemini account. Free tier (Flash / Flash-Lite)
 * gives ~1,500 requests/day at no cost. Server-only: the key never reaches the
 * browser and is never logged (we don't log the request URL, which carries it).
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Free-tier models. IDs the settings dropdown offers. */
export const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (추천)' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (가장 빠름)' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
] as const;

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export function isValidModel(model: string | null | undefined): boolean {
  return Boolean(model) && GEMINI_MODELS.some((m) => m.id === model);
}

type GenArgs = {
  system?: string;
  prompt: string;
  model?: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- Gemini JSON is untyped external data */

/** Call Gemini generateContent and return the text. Throws AppError on failure. */
export async function callGemini(apiKey: string, args: GenArgs): Promise<string> {
  const model = isValidModel(args.model) ? (args.model as string) : DEFAULT_GEMINI_MODEL;

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: args.prompt }] }],
    generationConfig: {
      temperature: args.temperature ?? 0.7,
      maxOutputTokens: args.maxTokens ?? 1024,
      ...(args.json ? { responseMimeType: 'application/json' } : {}),
    },
  };
  if (args.system) body.systemInstruction = { parts: [{ text: args.system }] };

  let res: Response;
  try {
    res = await fetch(`${BASE}/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AppError('GEMINI_NETWORK', 'Gemini에 연결하지 못했습니다.', 502);
  }

  if (!res.ok) {
    // Translate common failures WITHOUT echoing the key or raw body.
    const msg =
      res.status === 400 || res.status === 403
        ? 'Gemini API 키가 올바르지 않습니다. 키를 다시 확인해 주세요.'
        : res.status === 429
          ? 'Gemini 무료 사용량을 초과했습니다. 잠시 후 다시 시도해 주세요.'
          : `Gemini 오류가 발생했습니다. (${res.status})`;
    throw new AppError('GEMINI_ERROR', msg, 502);
  }

  const json = (await res.json().catch(() => null)) as any;
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('');
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Validate a key with the smallest possible call. A 200 (even with no text due
 * to the tiny token budget) means the key works; 400/403 means it's bad.
 */
export async function validateGeminiKey(apiKey: string, model: string): Promise<void> {
  await callGemini(apiKey, { prompt: 'ping', model, maxTokens: 1, temperature: 0 });
}
