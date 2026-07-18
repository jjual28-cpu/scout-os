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

const SYSTEM = `당신은 인플루언서 마케팅 전문가입니다. 브랜드 상품을 보고, 그 상품을 콘텐츠에 자연스럽게 보여줄 **인스타 크리에이터(셀럽)를 찾기 위한 검색 키워드**를 뽑습니다.

가장 중요한 원칙 — 상품의 "기능·형태"가 아니라 그 상품이 속한 **콘텐츠 분야(니치)** 를 고르세요:
- 찾는 대상은 그 상품을 리뷰·소개할 크리에이터입니다. 그들이 자기 계정을 규정하는 분야 키워드를 뽑으세요.
- 예: "메이크업 정리함(메이크업박스)" 이라면 → '수납정리·화장품정리함·파우치' 같은 정리/생활 키워드가 아니라, 그 박스를 쓸 **뷰티·메이크업 크리에이터**의 분야("뷰티","메이크업","코덕")를 뽑으세요. (정리·수납 키워드는 살림·판매 계정을 데려옵니다.)

규칙:
- 키워드 5~6개, 각 2~8자 한국어. 그 분야 크리에이터가 인스타에서 실제로 쓰는 분야/토픽 단어.
- **첫 번째 키워드는 크리에이터가 가장 많고 상품에 맞는 "대표 분야"** 로 (자동 검색이 이 첫 키워드를 씁니다).
- 브랜드명·상품명·상품의 형태(박스/정리함/케이스/세트 등)를 그대로 쓰지 말 것.
- 타겟 고객이 여성 위주면 여성 크리에이터가 많은 분야를 우선하세요.
- 판매/도매/공구/정리/수납 같은 판매자·살림 키워드, 너무 일반적인("일상","소통") 키워드, 존재하지 않을 긴 합성어는 피할 것.

예시:
- 메이크업 정리함: ["뷰티","메이크업","코덕","데일리메이크업","뷰티스타그램","화장"]
- 비건 바디로션: ["바디케어","비건뷰티","뷰티리뷰","셀프케어","홈케어","건성피부"]
- 골프공: ["골프","골프스타그램","골프패션","필드룩","골린이"]

오직 JSON 배열만 출력하세요. 설명 금지. 형식: ["대표분야","키워드2", ...]`;

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
