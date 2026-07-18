import 'server-only';

import { runAi } from './run';

/**
 * 상품 → 카테고리·추천 타겟·검색 키워드 한 번에 채우기. 카페24에서 끌어온 상품은
 * 이름·가격·이미지만 있고 카테고리/타겟/키워드가 비어 있어, AI가 상품명을 읽고
 * 한 번의 호출로 세 가지를 제안한다(사용자 데일리 캡에 카운트됨).
 */
export type AutofillProduct = {
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  usp?: string | null;
  sellingPoints?: string | null;
};

export type AutofillResult = {
  category: string;
  target: string;
  keywords: string[];
};

const SYSTEM = `당신은 인플루언서 마케팅 전문가입니다. 브랜드 상품 정보를 보고, 그 상품의 (1) 카테고리, (2) 추천 타겟 고객, (3) 어울리는 인스타 크리에이터를 찾을 검색 키워드를 제안합니다.

규칙:
- category: 짧은 분야명 1개 (예: "뷰티", "건강기능식품", "패션", "리빙"). 한국어 2~10자.
- target: 타겟 고객을 한 줄로 (예: "20~30대 여성, 홈케어 관심"). 한국어 40자 이내.
- keywords: 인스타에서 실제 검색되는 짧은 토픽 키워드 5~6개 (각 2~8자, 한국어). 브랜드명·상품명 그대로 쓰지 말 것.

오직 JSON 객체만 출력하세요. 설명 금지. 형식: {"category":"...","target":"...","keywords":["키워드1","키워드2"]}`;

/* eslint-disable @typescript-eslint/no-explicit-any -- model output is untyped JSON */
export async function autofillProduct(
  userId: string,
  product: AutofillProduct,
): Promise<AutofillResult> {
  const lines =
    [
      product.name ? `상품: ${product.name}` : null,
      product.brand ? `브랜드: ${product.brand}` : null,
      product.category ? `현재 카테고리: ${product.category}` : null,
      product.usp ? `차별점: ${product.usp}` : null,
      product.sellingPoints ? `판매 포인트: ${product.sellingPoints}` : null,
    ]
      .filter(Boolean)
      .join('\n') || '(상품 정보가 거의 없음 — 상품명 위주로 추정)';

  const text = await runAi(userId, {
    system: SYSTEM,
    prompt: `[상품]\n${lines}\n\n이 상품의 카테고리·추천 타겟·검색 키워드를 채워주세요.`,
    json: true,
    maxTokens: 300,
    temperature: 0.4,
  });

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return { category: '', target: '', keywords: [] };
  let raw: any;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { category: '', target: '', keywords: [] };
  }

  const category = typeof raw?.category === 'string' ? raw.category.trim().slice(0, 30) : '';
  const target = typeof raw?.target === 'string' ? raw.target.trim().slice(0, 120) : '';
  const rawKw: unknown[] = Array.isArray(raw?.keywords) ? raw.keywords : [];
  const keywords = [
    ...new Set(
      rawKw
        .filter((k: unknown): k is string => typeof k === 'string')
        .map((k) => k.trim().replace(/^#/, '').replace(/\s+/g, ''))
        .filter((k) => k.length >= 2 && k.length <= 12),
    ),
  ].slice(0, 6);

  return { category, target, keywords };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
