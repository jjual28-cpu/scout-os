import 'server-only';

import { runAi } from './run';

/**
 * Product → Instagram search keywords. The "AI 직원" starts here: instead of the
 * user guessing what to search, the AI reads the product and proposes the topics
 * that surface creators whose audience fits it.
 */
export type KeywordProduct = {
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  usp?: string | null;
  sellingPoints?: string | null;
  target?: string | null;
};

const SYSTEM = `당신은 인플루언서 마케팅 전문가입니다. 브랜드 상품 정보를 보고, 그 상품과 어울리는 인스타 크리에이터를 찾기 위한 검색 키워드를 뽑습니다.

규칙:
- 인스타에서 실제로 검색되는 짧은 분야/토픽 키워드 5~6개 (각 2~8자, 한국어).
- 브랜드명·상품명을 그대로 쓰지 말 것. 그 상품의 타겟 고객이 관심 갖는 분야·콘텐츠 주제로.
- 예(비건 바디로션): ["바디케어","비건뷰티","홈케어","셀프케어","건성피부","뷰티리뷰"]
- 너무 일반적("일상","소통")이거나 존재하지 않을 긴 합성어는 피할 것.

오직 JSON 배열만 출력하세요. 설명 금지. 형식: ["키워드1","키워드2"]`;

/* eslint-disable @typescript-eslint/no-explicit-any -- model output is untyped JSON */
export async function suggestKeywords(userId: string, product: KeywordProduct): Promise<string[]> {
  const lines =
    [
      product.name ? `상품: ${product.name}` : null,
      product.brand ? `브랜드: ${product.brand}` : null,
      product.category ? `카테고리: ${product.category}` : null,
      product.usp ? `차별점: ${product.usp}` : null,
      product.sellingPoints ? `판매 포인트: ${product.sellingPoints}` : null,
      product.target ? `타겟 고객: ${product.target}` : null,
    ]
      .filter(Boolean)
      .join('\n') || '(상품 정보가 거의 없음 — 분야 위주로 폭넓게)';

  const text = await runAi(userId, {
    system: SYSTEM,
    prompt: `[상품]\n${lines}\n\n이 상품에 맞는 셀럽을 찾을 검색 키워드를 뽑아주세요.`,
    json: true,
    maxTokens: 200,
    temperature: 0.4,
  });

  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  let raw: any;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .filter((k: unknown): k is string => typeof k === 'string')
        .map((k: string) => k.trim().replace(/^#/, '').replace(/\s+/g, ''))
        .filter((k: string) => k.length >= 2 && k.length <= 12),
    ),
  ].slice(0, 6);
}
/* eslint-enable @typescript-eslint/no-explicit-any */
