import 'server-only';

import { type InstagramCreator } from '@/features/search/instagram';

import { runAi } from './run';

/**
 * AI creator matching — the layer that makes this a matching tool rather than a
 * hashtag scraper.
 *
 * Apify casts a wide net and returns whatever mentions the keyword: real
 * creators, news/info accounts, shops, spam. This reads each candidate's actual
 * profile (bio, category, follower shape) against the brand/product and decides
 * whether it's genuinely a fit — the judgement a human would make by opening 24
 * profiles one by one.
 *
 * ONE AI call scores the whole batch (~1원/search), so it stays cheap and counts
 * as a single call against the user's daily cap.
 */

/** What the brand is selling — drives "is this creator right for THIS product". */
export type BrandContext = {
  productName?: string | null;
  brand?: string | null;
  category?: string | null;
  usp?: string | null;
  sellingPoints?: string | null;
  target?: string | null;
};

export type MatchVerdict = 'fit' | 'maybe' | 'reject';

export type CreatorMatch = {
  username: string;
  score: number; // 0~100
  verdict: MatchVerdict;
  reason: string;
};

const SYSTEM = `당신은 인플루언서 마케팅 전문가입니다. 브랜드가 협업할 인스타그램 셀럽 후보를 심사합니다.

후보 목록은 해시태그/키워드로 기계적으로 수집된 것이라 관련 없는 계정이 많이 섞여 있습니다.
당신의 일은 "이 브랜드가 실제로 협업 제안을 보낼 만한 계정인가"를 냉정하게 판별하는 것입니다.

반드시 reject 할 것:
- 정보성·뉴스·이슈·짤 계정 (직접 콘텐츠를 만드는 셀럽이 아님)
- 검색 주제와 실제로 무관한 계정
- 대형 브랜드·기업 공식 계정 (협업 대상이 아니라 경쟁사/타 브랜드)
- 스팸, 팔로워 장사, 판매 대행, 홍보 대행 계정
- 소개글이 비어 있고 정체를 알 수 없는 계정

fit 으로 볼 것:
- 해당 분야에서 직접 콘텐츠를 만드는 실제 크리에이터
- 브랜드의 타겟 고객층과 결이 맞는 계정
- 협업 제안이 자연스러운 규모/성격

점수 기준: 90+ 매우 적합 / 70~89 적합 / 40~69 애매 / 40 미만 부적합
verdict: fit(추천) | maybe(애매) | reject(제외)
reason: 한국어 한 줄(35자 이내), 판단 근거를 구체적으로. "관련 있음" 같은 뻔한 말 금지.

오직 JSON 배열만 출력하세요. 설명 금지.
형식: [{"username":"...","score":85,"verdict":"fit","reason":"..."}]
모든 후보를 빠짐없이 포함하세요.`;

function brandBlock(brand: BrandContext | null, query: string): string {
  if (!brand || !(brand.productName || brand.brand || brand.category)) {
    return `[브랜드 정보 없음]
검색 의도: "${query}"
→ 이 검색 의도에 맞는 진짜 크리에이터인지만 판별하세요. 정보성/무관 계정을 걸러내는 데 집중하세요.`;
  }
  const lines = [
    brand.productName ? `상품: ${brand.productName}` : null,
    brand.brand ? `브랜드: ${brand.brand}` : null,
    brand.category ? `카테고리: ${brand.category}` : null,
    brand.usp ? `USP: ${brand.usp}` : null,
    brand.sellingPoints ? `판매 포인트: ${brand.sellingPoints}` : null,
    brand.target ? `타겟 고객: ${brand.target}` : null,
  ].filter(Boolean);
  return `[협업을 제안할 브랜드]
${lines.join('\n')}
검색 의도: "${query}"
→ 이 브랜드가 이 셀럽에게 협업을 제안하는 게 말이 되는지 판단하세요.`;
}

function candidateBlock(creators: InstagramCreator[]): string {
  return creators
    .map((c, i) => {
      const bio = (c.biography ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
      return [
        `${i + 1}. @${c.username}`,
        `   이름: ${c.displayName || c.username}`,
        `   소개: ${bio || '(없음)'}`,
        `   카테고리: ${c.category ?? '(없음)'}`,
        `   팔로워: ${c.followersCount ?? '?'} · 게시물: ${c.postsCount ?? '?'}${c.isVerified ? ' · 인증됨' : ''}`,
      ].join('\n');
    })
    .join('\n');
}

/* eslint-disable @typescript-eslint/no-explicit-any -- model output is untyped JSON */

/** Pull the JSON array out of a model reply that may be fenced or padded. */
function parseMatches(text: string): CreatorMatch[] {
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

  const out: CreatorMatch[] = [];
  for (const r of raw) {
    const username = typeof r?.username === 'string' ? r.username.replace(/^@/, '').trim() : '';
    if (!username) continue;
    const n = Number(r?.score);
    const score = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 50;
    const v = r?.verdict;
    const verdict: MatchVerdict =
      v === 'fit' || v === 'maybe' || v === 'reject'
        ? v
        : score >= 70
          ? 'fit'
          : score >= 40
            ? 'maybe'
            : 'reject';
    const reason = typeof r?.reason === 'string' ? r.reason.trim().slice(0, 80) : '';
    out.push({ username, score, verdict, reason });
  }
  return out;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Score a batch of candidates. Returns a map keyed by lowercase username.
 * Throws only if the AI layer itself refuses (no key / over the daily cap) —
 * callers treat any failure as "no verdicts" and still show the raw results.
 */
export async function matchCreators(
  userId: string,
  query: string,
  creators: InstagramCreator[],
  brand: BrandContext | null,
): Promise<Map<string, CreatorMatch>> {
  if (creators.length === 0) return new Map();

  const prompt = `${brandBlock(brand, query)}

[후보 ${creators.length}명]
${candidateBlock(creators)}`;

  const text = await runAi(userId, {
    system: SYSTEM,
    prompt,
    json: true,
    // ~24 candidates × a short verdict each; leaves room without runaway cost.
    maxTokens: 2000,
    temperature: 0.2,
  });

  const map = new Map<string, CreatorMatch>();
  for (const m of parseMatches(text)) map.set(m.username.toLowerCase(), m);
  return map;
}
