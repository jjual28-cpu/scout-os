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
  /** 주 시청자층 AI 추정 (예: "20~30대 여성·뷰티"). 측정값 아님. 없으면 ''. */
  audience?: string;
};

/**
 * What the user is hunting for. Near-opposites: creator 검색은 브랜드/판매자를
 * 걸러내고, brand 검색은 그것만 남기고, gonggu 검색은 '공동구매로 파는 셀러'를
 * 찾는다(해시태그가 아니라 소개글 패턴으로 판별). 목적을 잘못 고르면 원하는 걸
 * 정확히 버린다.
 */
export type SearchTarget = 'creator' | 'brand' | 'gonggu';

/**
 * 공동구매(공구) 셀러 신호 — 소개글 기반. 공구 셀러는 #공동구매 같은 해시태그를
 * 잘 안 쓰고, 대신 프로필에 이렇게 티가 난다:
 *  - 공구/오픈카톡/주문서/폼/스마트스토어 같은 판매·주문 표현
 *  - 날짜별 공구 일정 (예: "7/10~17 바디워시 · 7/18~21 립밤") → M/D 날짜가 2개 이상
 */
const GONGGU_WORDS = [
  '공구',
  '공동구매',
  '공구일정',
  '공구문의',
  '공구마감',
  '오픈카톡',
  '오픈채팅',
  '카톡문의',
  '주문서',
  '주문폼',
  '네이버폼',
  '폼주소',
  '스마트스토어',
  '재오픈',
  '리오더',
  '마감임박',
  '프로필링크',
  'dm문의',
  '디엠문의',
];
export function looksLikeGonggu(bio: string | null): boolean {
  if (!bio) return false;
  const b = bio.toLowerCase();
  if (GONGGU_WORDS.some((w) => b.includes(w))) return true;
  // 날짜형 공구 일정: "M/D" 패턴이 2개 이상이면 판매 캘린더로 본다.
  const md = b.match(/\d{1,2}\s*\/\s*\d{1,2}/g);
  if (md && md.length >= 2) return true;
  const kd = b.match(/\d{1,2}월\s*\d{1,2}일/g);
  if (kd && kd.length >= 2) return true;
  return false;
}

const COMMON_TAIL = `점수 기준: 90+ 매우 적합 / 70~89 적합 / 40~69 애매 / 40 미만 부적합
verdict: fit(추천) | maybe(애매) | reject(제외)
reason: 한국어 한 줄(35자 이내), 판단 근거를 구체적으로. "관련 있음" 같은 뻔한 말 금지.
audience: 이 계정의 주 시청자층 추정 한 줄 (예: "20~30대 여성·뷰티"). 소개글·콘텐츠 근거로만 추정하고, 근거 없으면 빈 문자열 "". 사실처럼 단정하지 말 것(추정임).

오직 JSON 배열만 출력하세요. 설명 금지.
형식: [{"username":"...","score":85,"verdict":"fit","reason":"...","audience":"20~30대 여성·뷰티"}]
모든 후보를 빠짐없이 포함하세요.`;

const SYSTEM_CREATOR = `당신은 인플루언서 마케팅 전문가입니다. 브랜드가 협업할 인스타그램 셀럽 후보를 심사합니다.

후보 목록은 해시태그/키워드로 기계적으로 수집된 것이라 관련 없는 계정이 많이 섞여 있습니다.
당신의 일은 "이 브랜드가 실제로 협업 제안을 보낼 만한 계정인가"를 냉정하게 판별하는 것입니다.

반드시 reject 할 것:
- 정보성·뉴스·이슈·짤 계정 (직접 콘텐츠를 만드는 셀럽이 아님)
- 검색 주제와 실제로 무관한 계정
- 브랜드·쇼핑몰 공식 계정 (협업할 사람이 아니라 판매자)
- **계정 이름·아이디에 제품/브랜드명이 그대로 들어간 판매·유통 계정** (예: 검색 주제가 '샴푸'인데 아이디가 xxx_shampoo·샴푸공식·ts샴푸 등 — 그 제품을 파는 곳이지 리뷰·협업하는 셀럽이 아님). 그 제품을 "직접 파는" 계정은 셀럽이 아니다.
- 스팸, 팔로워 장사, 판매 대행, 홍보 대행 계정
- 소개글이 비어 있고 정체를 알 수 없는 계정
- 동네 가게·지역업체·시술/방문 서비스·예약 전용 업체 — 협업할 콘텐츠 셀럽이 아니라 '가게'다. (단, 아래 '지역 업체 검색 예외' 참고)
  · 특히 [지역명+업종] 이름의 로컬 뷰티샵을 확실히 reject: 눈썹문신·반영구·속눈썹·왁싱·네일샵·피부관리·에스테틱·미용실·헤어샵·태닝·필라테스·요가원 등 (예: "울산눈썹문신", "세종피부관리", "대구반영구"). 이런 곳은 뷰티 해시태그를 달아도 협업 셀럽이 아니라 시술을 파는 매장이다.
  · 소개글에 예약·오시는길·영업시간·시술문의·지점 같은 방문/예약 안내가 있으면 매장 계정이다 → reject.
  · 셀렉트샵·편집샵·소품샵·스마트스토어 등 리테일/판매 계정도 reject.

fit 으로 볼 것:
- 해당 분야에서 직접 콘텐츠를 만드는 실제 크리에이터
- 브랜드의 타겟 고객층과 결이 맞는 계정
- 협업 제안이 자연스러운 규모/성격

트렌드/라이징 검색일 때 (query/intent가 요즘 뜨는·성장 중·대세·라이징 성격이면):
후보에 주어지는 '최근 활동'(마지막 게시 N일 전, 최근 평균 좋아요·댓글)을 핵심 신호로 쓸 것:
- 최근(대략 4주 이내)에 꾸준히 올리는 계정을 우대한다. "처음부터 쭉 컸던 사람"이 아니라 "지금 활발한 사람"을 찾는 것이다.
- 마지막 게시가 수개월 이상 지났거나 '최근 게시물 없음'이면, 팔로워가 아무리 많아도 '죽은 계정'이니 트렌드 검색에서 fit 아님(크게 감점). 게시물 수 0도 마찬가지.
- 팔로워 대비 좋아요·댓글이 활발한(참여가 뜨거운) 계정을 우대한다. 규모는 작아도 최근 반응이 뜨거우면 위로, 크기만 하고 최근 반응이 식었으면 아래로.
- 작지만 최근 활발한 계정을 규모만 보고 reject 하지 말 것.
- '최근 활동' 정보가 없는 후보는 팔로워·게시물수·소개글로만 판단(예전 방식).
- 단, 위 우대는 아래 '반드시 reject 할 것'을 절대 완화하지 않는다 (정보성/뉴스/짤, 무관, 브랜드·쇼핑몰 공식계정, 스팸·팔로워장사·대행, 빈 계정은 그대로 reject).

지역 업체 검색 예외:
- 검색 의도가 특정 지역의 가게·업체 자체를 찾는 것이면 (예: "충주 마사지샵 계정 찾아줘") 위 '동네 가게·업체' reject를 적용하지 말고, 그 지역·업종에 맞는 업체 계정을 fit으로 볼 것.

${COMMON_TAIL}`;

const SYSTEM_BRAND = `당신은 브랜드 발굴 전문가입니다. 인스타그램 계정 중 "실제 브랜드/제품을 파는 공식 계정"을 골라냅니다.

후보 목록은 해시태그/키워드로 기계적으로 수집된 것이라 관련 없는 계정이 많이 섞여 있습니다.
당신의 일은 "이게 진짜 그 분야의 브랜드 계정인가"를 냉정하게 판별하는 것입니다.

fit 으로 볼 것 (이번 검색의 목표):
- 자기 제품을 파는 브랜드·쇼핑몰 공식 계정
- 프로필에 구매 링크·스토어 링크·제품 소개가 있는 계정
- 해당 분야의 신생/소규모 브랜드도 적극 fit (오히려 가치 있음)

반드시 reject 할 것:
- 개인 크리에이터·인플루언서·리뷰어 (브랜드가 아니라 사람)
- 정보성·뉴스·이슈·짤 계정
- 검색 주제와 실제로 무관한 계정
- 스팸, 팔로워 장사, 공동구매 대행, 홍보 대행 계정
- 소개글이 비어 있고 정체를 알 수 없는 계정

${COMMON_TAIL}`;

const SYSTEM_GONGGU = `당신은 공동구매(공구) 셀러 발굴 전문가입니다. 인스타그램 계정 중 "제품을 공동구매로 파는 셀러/호스트"를 골라냅니다.

중요: 이들은 보통 #공동구매 같은 해시태그를 잘 안 씁니다. 대신 프로필(소개글)과 콘텐츠에서 이렇게 티가 납니다:
- 소개글에 '공구 일정'을 날짜로 적어둠 (예: "7/10~17 바디워시 · 7/18~21 립밤")
- 공구·공동구매·오픈카톡·오픈채팅·주문서·주문폼·네이버폼·스마트스토어·카톡문의·DM문의·재오픈·마감임박 같은 표현
- 특정 제품들을 주기적으로 홍보/판매, 프로필 링크로 주문 유도
각 후보에 '공구 신호: 있음/없음'을 표시해 두었으니 핵심 단서로 쓰세요.

fit 으로 볼 것 (이번 검색 목표):
- 위 신호가 보이는 공구 셀러/호스트 (규모 작아도 구매 전환 팬층이 있으면 가치 큼)
- 여러 제품을 주기적으로 공구하는 계정. '공구 신호: 있음'이면 강하게 우대.

반드시 reject 할 것:
- 협업/광고만 받는 순수 콘텐츠 크리에이터 (직접 판매하지 않음)
- 브랜드·쇼핑몰 공식 계정 (셀러가 아니라 제조·판매사 본사)
- **지역 시술·방문 매장** — 자기 시술을 파는 '가게'지 내 상품을 공구로 팔아줄 셀러가 아니다.
  예: "세종피부관리", "대구눈썹문신", "부천 탈모관리", 에스테틱·왁싱·네일샵·미용실·클리닉·필라테스.
  소개에 예약·오시는길·영업시간·시술문의·원장 같은 방문/시술 안내가 있으면 매장이다 → reject.
- **제작사·광고/마케팅 대행사** (예: "영상 제작", "AI 광고 제작", "협업 문의" 위주의 업체 계정)
- **게시물이 0개이거나 사실상 없는 빈 계정** — 팔로워가 있어도 팔 수 있는 채널이 아니다.
- 정보성·뉴스·짤·검색 주제와 무관한 계정
- 스팸, 팔로워 장사, 소개가 비어 정체불명인 계정

'공구 신호: 없음'이어도 소개·콘텐츠로 공구 셀러가 분명하면 fit 가능(과도하게 reject하지 말 것).

${COMMON_TAIL}`;

function brandBlock(brand: BrandContext | null, query: string, target: SearchTarget): string {
  const noun =
    target === 'brand' ? '브랜드 계정' : target === 'gonggu' ? '공구 셀러' : '크리에이터';

  if (!brand || !(brand.productName || brand.brand || brand.category)) {
    return `[내 상품 정보 없음]
검색 의도: "${query}"
→ 이 검색 의도에 맞는 진짜 ${noun}인지만 판별하세요. 정보성/무관 계정을 걸러내는 데 집중하세요.`;
  }
  const lines = [
    brand.productName ? `상품: ${brand.productName}` : null,
    brand.brand ? `브랜드: ${brand.brand}` : null,
    brand.category ? `카테고리: ${brand.category}` : null,
    brand.usp ? `USP: ${brand.usp}` : null,
    brand.sellingPoints ? `판매 포인트: ${brand.sellingPoints}` : null,
    brand.target ? `타겟 고객: ${brand.target}` : null,
  ].filter(Boolean);

  // The product means opposite things per target: who to pitch TO vs. what
  // field the account should be in. Same block, inverted question.
  if (target === 'brand') {
    return `[검색하는 사람의 상품 — 참고용]
${lines.join('\n')}
검색 의도: "${query}"
→ 이 상품과 같은 분야의 브랜드 계정인지 판단하세요. 상품 자체를 파는 계정일 필요는 없습니다.`;
  }
  if (target === 'gonggu') {
    return `[공동구매로 팔 상품]
${lines.join('\n')}
검색 의도: "${query}"
→ 이 계정이 '이 상품을 공동구매로 팔 만한 공구 셀러'인지 판단하세요. 같은 분야(뷰티·리빙·육아 등) 제품을 공구로 파는 셀러면 fit.`;
  }
  return `[협업을 제안할 브랜드]
${lines.join('\n')}
검색 의도: "${query}"
→ 이 브랜드가 이 셀럽에게 협업을 제안하는 게 말이 되는지 판단하세요.`;
}

/** A human "최근 활동" line — the rising signal. Null when we have no post data. */
function activityLine(c: InstagramCreator, now: number): string | null {
  const hasAny = c.lastPostAt || c.recentAvgLikes != null || c.recentAvgComments != null;
  if (!hasAny) return null;
  const parts: string[] = [];
  if (c.lastPostAt) {
    const days = Math.floor((now - Date.parse(c.lastPostAt)) / 86_400_000);
    parts.push(Number.isFinite(days) ? `마지막 게시 ${days}일 전` : '마지막 게시일 미상');
  } else {
    parts.push('최근 게시물 없음');
  }
  if (c.recentAvgLikes != null || c.recentAvgComments != null) {
    parts.push(`최근 평균 좋아요 ${c.recentAvgLikes ?? '?'}·댓글 ${c.recentAvgComments ?? '?'}`);
  }
  return `   최근 활동: ${parts.join(' · ')}`;
}

function candidateBlock(creators: InstagramCreator[], target: SearchTarget): string {
  const now = Date.now();
  return creators
    .map((c, i) => {
      const bio = (c.biography ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
      return [
        `${i + 1}. @${c.username}`,
        `   이름: ${c.displayName || c.username}`,
        `   소개: ${bio || '(없음)'}`,
        `   카테고리: ${c.category ?? '(없음)'}`,
        `   팔로워: ${c.followersCount ?? '?'} · 게시물: ${c.postsCount ?? '?'}${c.isVerified ? ' · 인증됨' : ''}`,
        // 공구 검색일 때만 소개글 공구 신호를 표시해 판정을 돕는다.
        target === 'gonggu'
          ? `   공구 신호: ${looksLikeGonggu(c.biography) ? '있음' : '없음'}`
          : null,
        activityLine(c, now),
      ]
        .filter(Boolean)
        .join('\n');
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
    const audience = typeof r?.audience === 'string' ? r.audience.trim().slice(0, 40) : '';
    out.push({ username, score, verdict, reason, audience });
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
  target: SearchTarget = 'creator',
): Promise<Map<string, CreatorMatch>> {
  if (creators.length === 0) return new Map();

  const prompt = `${brandBlock(brand, query, target)}

[후보 ${creators.length}개]
${candidateBlock(creators, target)}`;

  const text = await runAi(userId, {
    system:
      target === 'brand' ? SYSTEM_BRAND : target === 'gonggu' ? SYSTEM_GONGGU : SYSTEM_CREATOR,
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
