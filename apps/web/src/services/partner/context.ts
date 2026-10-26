import { createHash } from 'node:crypto';

import { type BrandContext } from '@/services/ai/match';

import { type RecommendRequest } from './schema';

/**
 * Turning a Cellink request into (a) a cache key and (b) the extra context the
 * search planner and the AI judge read. Pure functions — unit-tested.
 */

/** Baselines that always apply (filters can only narrow them). */
export const BASELINE_MIN_ER = 0.02; // 2%
export const BASELINE_RECENT_DAYS = 30;

const norm = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const normList = (a: (string | null | undefined)[] | null | undefined) =>
  [...new Set((a ?? []).map(norm).filter(Boolean))].sort();

/**
 * Same key = same search, shared across malls. Covers everything that changes
 * WHO gets searched/judged as fit: keywords · target · brand profile · product
 * · notes. Filters/excludeUsernames/limit are applied per request afterwards,
 * so they're deliberately left out (more cache hits, same accuracy).
 */
export function cacheKeyFor(input: RecommendRequest): string {
  const bp = input.brandProfile ?? {};
  const basis = {
    v: 1,
    keywords: normList(input.keywords),
    target: input.target ?? 'creator',
    brand: {
      summary: norm(bp.summary),
      gender: bp.audienceGender ?? 'any',
      ages: normList(bp.audienceAges),
      price: norm(bp.priceRange),
      style: normList(bp.styleKeywords),
    },
    product: {
      name: norm(input.productName),
      desc: norm(input.productDescription),
      category: norm(input.category),
    },
    notes: norm(input.notes),
  };
  return createHash('sha256').update(JSON.stringify(basis)).digest('hex');
}

const GENDER_KO = { female: '여성', male: '남성', any: '무관' } as const;
const AGE_KO: Record<string, string> = {
  '10s': '10대',
  '20s': '20대',
  '30s': '30대',
  '40s': '40대',
  '50s': '50대',
  '60s': '60대 이상',
};

function audienceLine(input: RecommendRequest): string | null {
  const bp = input.brandProfile;
  if (!bp) return null;
  const parts = [
    bp.audienceGender && bp.audienceGender !== 'any' ? GENDER_KO[bp.audienceGender] : null,
    bp.audienceAges?.length ? bp.audienceAges.map((a) => AGE_KO[a] ?? a).join('·') : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

/** The product as the existing judge's BrandContext (상품·브랜드·타겟 고객). */
export function brandContextFor(input: RecommendRequest): BrandContext {
  const audience = audienceLine(input);
  return {
    productName: input.productName,
    brand: input.brandProfile?.summary ?? null,
    category: input.category ?? null,
    usp: input.productDescription ?? null,
    sellingPoints:
      input.productPrice != null ? `가격 ${input.productPrice.toLocaleString('ko-KR')}원` : null,
    target: audience ? `${audience} 고객` : null,
  };
}

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}`;
}

/**
 * The full "who/what/conditions" block. Shared by the planner (so the hashtags
 * reach the brand's customers) and the judge (so a fit is a fit for THIS brand,
 * not merely on topic).
 */
export function partnerContextBlock(input: RecommendRequest): string {
  const bp = input.brandProfile ?? {};
  const f = input.filters ?? {};
  const lines: string[] = [];

  lines.push('[브랜드 프로필 — 누구에게 파는가]');
  if (bp.summary) lines.push(`브랜드: ${bp.summary}`);
  const audience = audienceLine(input);
  lines.push(`주 고객: ${audience ?? '정보 없음'}`);
  if (bp.priceRange) lines.push(`가격대: ${bp.priceRange}`);
  if (bp.styleKeywords?.length) lines.push(`브랜드 분위기: ${bp.styleKeywords.join(', ')}`);

  lines.push('', '[파는 상품 — 무엇을 파는가]');
  lines.push(`상품명: ${input.productName}`);
  if (input.productDescription) lines.push(`설명: ${input.productDescription}`);
  if (input.productPrice != null) lines.push(`가격: ${won(input.productPrice)}원`);
  if (input.category) lines.push(`카테고리: ${input.category}`);
  lines.push(`검색 키워드: ${input.keywords.join(', ')}`);

  lines.push('', '[찾는 사람]');
  lines.push(
    (input.target ?? 'creator') === 'gonggu'
      ? '협업 방식: 공동구매로 이 상품을 팔아 줄 공구 셀러'
      : '협업 방식: 협찬받아 이 상품을 리뷰·소개할 콘텐츠 크리에이터',
  );
  if (f.followerMin != null || f.followerMax != null) {
    lines.push(
      `팔로워 규모: ${f.followerMin != null ? won(f.followerMin) : '0'} ~ ${
        f.followerMax != null ? won(f.followerMax) : '제한 없음'
      }`,
    );
  }
  if (f.contentFormats?.length) {
    lines.push(
      `콘텐츠 형태: ${f.contentFormats.map((c) => (c === 'reels' ? '릴스' : '피드')).join(', ')}`,
    );
  }
  if (f.mustKeywords?.length) lines.push(`꼭 관련 있어야 할 주제: ${f.mustKeywords.join(', ')}`);
  if (f.excludeKeywords?.length) lines.push(`제외할 주제: ${f.excludeKeywords.join(', ')}`);
  if (input.notes) lines.push('', '[검색하는 사람의 설명]', input.notes);

  lines.push(
    '',
    '[판정 원칙 — 이번 검색은 실제 판매로 이어질 계정만 고른다]',
    '- 주제만 맞는 계정이 아니라, 위 브랜드의 주 고객(성별·연령·가격대·분위기)에게 실제로 닿는 계정만 fit.',
    '  (예: 주 고객이 30대 여성인데 콘텐츠·말투·팔로워가 10대 남성 위주면 reject)',
    '- 이 상품을 그 사람의 콘텐츠에 자연스럽게 넣을 수 있어야 한다. 억지로 끼워 맞춰야 하면 reject.',
    `- 최근 ${BASELINE_RECENT_DAYS}일 안에 게시물이 없으면 fit 금지.`,
    '- 쇼핑몰·브랜드 공식 계정, 제외할 주제를 주로 다루는 계정은 reject.',
    '- 애매하면 reject. 적게 고르더라도 확실한 계정만 fit.',
  );
  return lines.join('\n');
}

/** Hashtag list for stage 2: the user's keywords lead, AI tags fill (max 6). */
export function mergeHashtags(keywords: string[], aiTags: string[] | undefined): string[] {
  const clean = (t: string) => t.replace(/[#\s]+/g, '');
  const out: string[] = [];
  for (const t of [
    ...keywords.slice(0, 2).map(clean),
    ...(aiTags ?? []).map(clean),
    ...keywords.map(clean),
  ]) {
    if (t.length >= 2 && t.length <= 20 && !out.includes(t)) out.push(t);
    if (out.length >= 6) break;
  }
  return out;
}
