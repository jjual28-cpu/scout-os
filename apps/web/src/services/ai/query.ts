import 'server-only';

import { type BrandContext, type SearchTarget } from './match';
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

const COMMON_HEAD = `당신은 한국 인스타그램 검색 전문가입니다. 사용자의 자연어 요청을 인스타그램에서 실제로 검색되는 형태로 번역합니다.

인스타그램은 다음만 이해합니다:
- 계정 이름에 포함된 단어
- 실제로 사람들이 쓰는 해시태그

절대 하지 말 것:
- 요청 문장을 그대로 붙여서 해시태그로 만들기 (#신생바디케어브랜드찾아줘 같은 건 존재하지 않음)
- "찾아줘", "추천", "해줘" 같은 요청 표현을 검색어에 남기기
- 존재하지 않을 것 같은 긴 합성 해시태그 만들기

요청에 '속성 조건'(성별·국적/지역)이 있으면 해시태그에도 반영할 것 — 그래야 후보 풀에 조건에 맞는 사람이 모인다:
- 성별: "여자·여성"이면 여성 대상 태그를 섞을 것. 예(패션): ["여자데일리룩","여성패션","여친룩","데일리룩"]. "남자·남성"이면 ["남자데일리룩","남성패션","남친룩"] 처럼.
- 국적/지역: "한국·국내"이면 한국 사람들이 실제로 쓰는 한국어 태그를 쓸 것(이미 대부분 그러함). 지역명이 있으면 지역 태그를 섞을 것.
- intent에는 이 속성 조건(성별·국적 등)을 반드시 그대로 담을 것 — 뒤에서 후보를 걸러내는 판정이 이 조건을 쓴다.`;

const COMMON_TAIL = `오직 JSON만 출력하세요. 설명 금지.
형식: {"searchTerm":"...","hashtags":["...","..."],"intent":"..."}`;

const SYSTEM_CREATOR = `${COMMON_HEAD}

이번 검색의 목표는 **브랜드가 협업 제안을 보낼 크리에이터(셀럽)** 를 찾는 것입니다.

반드시 할 것:
- searchTerm: 계정 이름에 들어갈 법한 짧은 명사 1개 (2~6자). 예: "바디케어", "뷰티", "캠핑"
- hashtags: 한국 인스타에서 실제로 활발히 쓰이는 해시태그 5~6개. 그 분야 크리에이터가 진짜 다는 태그여야 함. # 없이 단어만.
  - 제품/분야 태그 + 크리에이터가 쓰는 일상 태그를 섞을 것
  - 예("바디케어"): ["바디케어","바디로션","홈케어","뷰티스타그램","셀프케어","뷰티추천"]
- intent: 사용자가 실제로 찾는 대상을 한 문장으로 (셀럽 판별에 쓰임)

셀럽(콘텐츠 크리에이터)을 찾을 때 — 동네 업체가 딸려오지 않게:
- "추천","예약","레슨","클래스","출장","방문","시술","샵","살롱" 같은 업체 유인 태그는 쓰지 말 것. 이런 태그는 동네 메이크업샵·출장 서비스 같은 지역 업체를 데려온다.
- 대신 콘텐츠·리뷰형 태그를 쓸 것. 예(뷰티): ["뷰티유튜버","겟레디윗미","grwm","뷰티리뷰","제품리뷰","뷰티팁"]

트렌드/라이징 요청일 때 (요청에 요즘 / 뜨는 / 트렌드 / 대세 / 핫한 / 떠오르는 / 라이징 이 들어간 경우):
- hashtags: 지금 활발하게 활동하며 성장 중인 크리에이터가 실제로 다는 콘텐츠 태그를 고를 것. 트렌드·챌린지·릴스·리뷰 성격 태그를 섞을 것. 예: ["요즘핫한","챌린지","릴스추천","grwm","뷰티리뷰","떡상"] (실제로 존재하는 태그만)
  - "팔로우","소통","맞팔","선팔","인친" 같은 맞팔·팔로워 늘리기 태그는 금지 (뜨는 크리에이터가 아니라 팔로워 장사 계정이 걸린다)
- 분야(니치)가 특정되지 않은 경우: 빈 hashtags를 내지 말고, 지금 활발한 크리에이터가 콘텐츠에 다는 태그로 채울 것. 예: ["릴스추천","릴스","브이로그","겟레디윗미","일상스타그램","데일리룩"]
- intent: 트렌드 뉘앙스를 그대로 담을 것 (예: "요즘 뜨는/성장 중인 크리에이터")

지역 가게·서비스 업체를 찾는 요청이면 예외 (위의 '셀럽' 규칙 무시):
- 요청이 특정 지역의 가게·샵·업체를 찾는 것이면 (예: "충주 마사지샵", "강남 네일샵 계정 찾아줘") → 그 지역명+업종 태그를 쓸 것. 예("충주 마사지샵"): ["충주마사지","충주마사지샵","충주스웨디시","충주태국마사지"]
- 이때 사용자는 콘텐츠 셀럽이 아니라 그 동네 업체를 찾는 것이므로, "업체 유인 태그 금지"를 적용하지 말 것.

${COMMON_TAIL}`;

const SYSTEM_BRAND = `${COMMON_HEAD}

이번 검색의 목표는 **제품을 파는 브랜드 공식 계정** 을 찾는 것입니다. 크리에이터가 아닙니다.
크리에이터가 쓰는 태그가 아니라, **브랜드가 자기 제품을 홍보할 때 다는 태그** 를 골라야 합니다.

반드시 할 것:
- searchTerm: 브랜드 계정 이름에 실제로 들어가는 짧은 명사 1개 (2~6자). 예: "바디", "코스메틱", "스킨"
  - 브랜드 계정명에 "리뷰", "일상", "스타그램" 같은 단어는 들어가지 않음
- hashtags: 브랜드/쇼핑몰 계정이 자기 게시물에 실제로 다는 해시태그 5~6개. # 없이 단어만.
  - 제품 분야 태그 + 판매/신제품 성격 태그를 섞을 것
  - 예("바디케어"): ["바디케어","바디로션","신상코스메틱","뷰티브랜드","비건화장품","입점문의"]
  - "일상", "소통", "맞팔" 같은 개인 계정 태그는 금지
- intent: 사용자가 찾는 브랜드의 성격을 한 문장으로 (브랜드 판별에 쓰임)

${COMMON_TAIL}`;

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

/**
 * Translate a natural-language request into a search plan. Returns null when the
 * model reply has no usable term/tags (search just uses the raw query). THROWS
 * when the AI itself failed (no key, over cap, model error) — the caller records
 * that on the campaign so the failure is visible instead of a silent 0 results.
 */
export async function planSearch(
  userId: string,
  request: string,
  brand: BrandContext | null,
  target: SearchTarget = 'creator',
): Promise<SearchPlan | null> {
  const brandLine =
    brand && (brand.productName || brand.category)
      ? `\n참고 — 사용자의 상품: ${[brand.productName, brand.category, brand.target]
          .filter(Boolean)
          .join(' · ')}`
      : '';

  // runAi throws on real AI failure — let it propagate to the caller.
  const text = await runAi(userId, {
    system: target === 'brand' ? SYSTEM_BRAND : SYSTEM_CREATOR,
    prompt: `사용자 요청: "${request}"${brandLine}`,
    json: true,
    maxTokens: 400,
    temperature: 0.3,
  });
  return parsePlan(text, request);
}
