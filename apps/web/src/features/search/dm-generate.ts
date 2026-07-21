import { extractAiSlots, fillVariables, replaceAiSlots } from './dm-template';

/**
 * 저장된 "내 DM 스타일"(template)을 실제 DM으로 만드는 공용 헬퍼.
 * 모든 DM 생성 지점(상세·CRM 드로어·아웃리치 리스트)이 이걸 써서 동일하게 동작한다.
 *
 * - template 이 있으면: 그 틀을 쓰고 [[ai:]] 구간만 이 셀럽에 맞춰 AI가 채운다.
 *   {셀럽}/{상품}/{브랜드} 변수는 값으로 치환(없으면 원형 유지).
 * - template 이 없으면: fallback(규칙 기반 초안)을 그대로 쓴다.
 * - AI 호출 실패 시에도 fallback 을 반환해 흐름이 끊기지 않는다.
 */
export type DmCreator = {
  displayName: string;
  username: string;
  biography: string | null;
  category: string | null;
  followersCount: number | null;
};
export type DmBrand = {
  productName?: string | null;
  brand?: string | null;
  category?: string | null;
  usp?: string | null;
  sellingPoints?: string | null;
  target?: string | null;
} | null;

/**
 * "AI DM 생성" — 저장한 틀 없이 AI가 이 셀럽에 맞춰 DM 전체를 새로 쓴다(/api/ai/dm).
 * 실패하면 fallback(규칙 기반)을 반환해 흐름이 끊기지 않는다.
 */
export async function generateAiDm(opts: {
  creator: DmCreator;
  brand?: DmBrand;
  fallback: string;
}): Promise<{ text: string; error?: string }> {
  const { creator, brand = null, fallback } = opts;
  try {
    const res = await fetch('/api/ai/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creator, brand }),
    });
    const json = (await res.json().catch(() => null)) as {
      data?: { text?: string };
      error?: { message?: string };
    } | null;
    const text = json?.data?.text?.trim();
    if (!res.ok || !text) {
      return { text: fallback, error: json?.error?.message ?? 'AI 초안 생성에 실패했어요.' };
    }
    return { text };
  } catch {
    return { text: fallback, error: 'AI 초안 생성 중 문제가 발생했어요.' };
  }
}

export async function generateStyledDm(opts: {
  template: string;
  creator: DmCreator;
  brand?: DmBrand;
  /** 템플릿이 없거나 AI가 실패할 때 쓸 규칙 기반 초안. */
  fallback: string;
}): Promise<{ text: string; error?: string }> {
  const { creator, brand = null, fallback } = opts;
  const tpl = opts.template.trim();
  if (!tpl) return { text: fallback };

  try {
    const vars = {
      셀럽: creator.displayName || creator.username,
      상품: brand?.productName ?? '',
      브랜드: brand?.brand ?? '',
    };
    const prepared = fillVariables(tpl, vars);
    const slots = extractAiSlots(prepared);
    if (slots.length === 0) return { text: replaceAiSlots(prepared, []) };

    const res = await fetch('/api/ai/dm-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creator, brand, slots }),
    });
    const json = (await res.json().catch(() => null)) as {
      data?: { texts?: string[] };
      error?: { message?: string };
    } | null;
    if (!res.ok) {
      return { text: fallback, error: json?.error?.message ?? 'AI 초안 생성에 실패했어요.' };
    }
    return { text: replaceAiSlots(prepared, json?.data?.texts ?? []) };
  } catch {
    return { text: fallback, error: 'AI 초안 생성 중 문제가 발생했어요.' };
  }
}
