import 'server-only';

import { type BrandContext } from './match';
import { runAi } from './run';

/**
 * Natural language → an actual Instagram search plan.
 *
 * Users type the way they'd talk to an assistant ("신생 바디케어 브랜드 찾아줘").
 * Instagram only understands account names and hashtags, so that phrase matches
 * nothing: no account is named it, and #신생바디케어브랜드찾아줘 doesn't exist.
 * This turns the request into terms Instagram can actually answer.
 *
 * Best-effort: any failure falls back to the raw query (previous behaviour), so
 * search never breaks because AI was unavailable.
 */

export type SearchPlan = {
  /** Short noun for the profile-name search (stage 1). */
  searchTerm: string;
  /** Real, in-use Korean hashtags for the post search (stage 2). */
  hashtags: string[];
  /** What the user actually wants — used as context when AI judges fit. */
  intent: string;
};

const SYSTEM = `당신은 한국 인스타그램 검색 전문가입니다. 사용자의 자연어 요청을 인스타그램에서 실제로 검색되는 형태로 번역합니다.

인스타그램은 다음만 이해합니다:
- 계정 이름에 포함된 단어
- 실제로 사람들이 쓰는 해시태그

절대 하지 말 것:
- 요청 문장을 그대로 붙여서 해시태그로 만들기 (#신생바디케어브랜드찾아줘 같은 건 존재하지 않음)
- "찾아줘", "추천", "해줘" 같은 요청 표현을 검색어에 남기기
- 존재하지 않을 것 같은 긴 합성 해시태그 만들기

반드시 할 것:
- searchTerm: 계정 이름에 들어갈 법한 짧은 명사 1개 (2~6자). 예: "바디케어", "뷰티", "캠핑"
- hashtags: 한국 인스타에서 실제로 활발히 쓰이는 해시태그 5~6개. 그 분야 크리에이터가 진짜 다는 태그여야 함. # 없이 단어만.
  - 제품/분야 태그 + 크리에이터가 쓰는 일상 태그를 섞을 것
  - 예("바디케어"): ["바디케어","바디로션","홈케어","뷰티스타그램","셀프케어","뷰티추천"]
- intent: 사용자가 실제로 찾는 대상을 한 문장으로 (셀럽 판별에 쓰임)

오직 JSON만 출력하세요. 설명 금지.
형식: {"searchTerm":"...","hashtags":["...","..."],"intent":"..."}`;

/**
 * Does this look like a sentence rather than a keyword? Single short words
 * ("골프") already work against Instagram, so we skip the AI call for them —
 * no latency, no cost, no daily-cap usage.
 */
export function looksNatural(query: string): boolean {
  const q = query.trim();
  if (q.includes(' ')) return true; // phrases
  return q.length > 8; // long single tokens are usually descriptive too
}

/* eslint-disable @typescript-eslint/no-explicit-any -- model output is untyped JSON */

function parsePlan(text: string, fallback: string): SearchPlan | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let raw: any;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }

  const searchTerm =
    typeof raw?.searchTerm === 'string' && raw.searchTerm.trim()
      ? raw.searchTerm.trim().replace(/^#/, '').slice(0, 20)
      : '';
  const hashtags = Array.isArray(raw?.hashtags)
    ? raw.hashtags
        .filter((h: unknown): h is string => typeof h === 'string')
        .map((h: string) => h.trim().replace(/^#/, '').replace(/\s+/g, ''))
        .filter((h: string) => h.length >= 2 && h.length <= 20)
        .slice(0, 6)
    : [];
  const intent = typeof raw?.intent === 'string' ? raw.intent.trim().slice(0, 120) : '';

  // A plan with neither a usable term nor tags is worse than the raw query.
  if (!searchTerm && hashtags.length === 0) return null;
  return {
    searchTerm: searchTerm || fallback,
    hashtags,
    intent: intent || fallback,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/** Translate a natural-language request into a search plan. Null on any failure. */
export async function planSearch(
  userId: string,
  request: string,
  brand: BrandContext | null,
): Promise<SearchPlan | null> {
  const brandLine =
    brand && (brand.productName || brand.category)
      ? `\n참고 — 사용자의 상품: ${[brand.productName, brand.category, brand.target]
          .filter(Boolean)
          .join(' · ')}`
      : '';

  try {
    const text = await runAi(userId, {
      system: SYSTEM,
      prompt: `사용자 요청: "${request}"${brandLine}`,
      json: true,
      maxTokens: 400,
      temperature: 0.3,
    });
    return parsePlan(text, request);
  } catch {
    return null; // fall back to the raw query — never break the search
  }
}
