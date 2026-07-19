import { type SearchResult, type SearchResultType } from './types';

/** A discovered opportunity for the daily feed — a result plus its 발견일. */
export type DiscoverOpportunity = SearchResult & {
  /** 발견일 — display-ready label (e.g. "오늘", "어제"). */
  discoveredAt: string;
  /** Public profile URL (real Instagram creators only; mock items omit it). */
  profileUrl?: string;
  /** Real-creator fields carried through for filters / sort / summary. */
  isVerified?: boolean;
  category?: string | null;
  postsCount?: number | null;
  biography?: string | null;
  /** AI fit verdict (0~100 + one-line reason). Undefined ⇒ AI hasn't judged it. */
  aiScore?: number | null;
  aiVerdict?: 'fit' | 'maybe' | 'reject' | null;
  aiReason?: string | null;
  /** 비주얼(이미지) 판정 — 옵션. Undefined ⇒ 사진 판정 안 함. */
  visualScore?: number | null;
  visualVerdict?: 'fit' | 'maybe' | 'reject' | null;
  visualReason?: string | null;
};

export type DiscoverCategory = {
  /** Section heading shown on the Discover page. */
  label: string;
  type: SearchResultType;
  items: DiscoverOpportunity[];
};

/**
 * Static mock feed for "Today's Opportunities". No API/engine — the goal is the
 * daily-discovery UX. Grouped into the five categories the product surfaces.
 */
export const DISCOVER_CATEGORIES: DiscoverCategory[] = [
  {
    label: '신규 브랜드',
    type: '신규 브랜드',
    items: [
      {
        id: 'd-moodself',
        name: '무드셀프',
        handle: 'moodself.official',
        type: '신규 브랜드',
        platform: 'instagram',
        reason: '이번 주 첫 제품을 출시했고, 초기 협업 파트너를 찾는 신호가 보여요.',
        opportunityScore: 90,
        recommendedAction: '런칭 기념 협업 제안하기',
        discoveredAt: '오늘',
      },
      {
        id: 'd-raoncos',
        name: '라온코스',
        handle: 'raoncos',
        type: '신규 브랜드',
        platform: 'instagram',
        reason: '3주 만에 팔로워 8천을 넘겼고, 앰버서더 모집을 언급했어요.',
        opportunityScore: 86,
        recommendedAction: '앰버서더 프로그램 문의하기',
        discoveredAt: '오늘',
      },
    ],
  },
  {
    label: '성장중인 마이크로 크리에이터',
    type: '마이크로 크리에이터',
    items: [
      {
        id: 'd-haru-beauty',
        name: '하루뷰티',
        handle: 'haru_beauty',
        type: '마이크로 크리에이터',
        platform: 'instagram',
        reason: '최근 릴스 평균 조회수가 3배로 뛰었고 참여율이 9%대예요.',
        opportunityScore: 89,
        recommendedAction: '제품 시딩 제안하기',
        discoveredAt: '오늘',
      },
      {
        id: 'd-choco-salon',
        name: '초코살롱',
        handle: 'choco_salon',
        type: '마이크로 크리에이터',
        platform: 'tiktok',
        reason: '2주 연속 팔로워가 급상승 중이고 뷰티 콘텐츠 비중이 늘고 있어요.',
        opportunityScore: 84,
        recommendedAction: '숏폼 협업 타진하기',
        discoveredAt: '어제',
      },
    ],
  },
  {
    label: '자체 브랜드 운영자',
    type: '브랜드 운영자',
    items: [
      {
        id: 'd-seoa',
        name: '김서아',
        handle: 'seoa.official',
        type: '브랜드 운영자',
        platform: 'youtube',
        reason: '자체 향수 브랜드 2호 제품을 예고했어요. 공동 마케팅 여지가 있어요.',
        opportunityScore: 87,
        recommendedAction: '공동 마케팅 미팅 제안하기',
        discoveredAt: '오늘',
      },
      {
        id: 'd-teo',
        name: '정테오',
        handle: 'teo.made',
        type: '브랜드 운영자',
        platform: 'instagram',
        reason: '직접 만든 액세서리 브랜드를 운영하며 리셀 파트너를 찾고 있어요.',
        opportunityScore: 82,
        recommendedAction: '리셀 파트너십 제안하기',
        discoveredAt: '어제',
      },
    ],
  },
  {
    label: '공구 셀러',
    type: '공구 셀러',
    items: [
      {
        id: 'd-salim-note',
        name: '살림노트',
        handle: 'salim_note',
        type: '공구 셀러',
        platform: 'instagram',
        reason: '이번 주 공동구매를 3회 완판했고 신규 카테고리로 확장 중이에요.',
        opportunityScore: 88,
        recommendedAction: '신제품 단독 공구 제안하기',
        discoveredAt: '오늘',
      },
      {
        id: 'd-daily-market',
        name: '데일리마켓',
        handle: 'daily_market',
        type: '공구 셀러',
        platform: 'instagram',
        reason: '구독형 공구를 도입했고 재구매율이 꾸준히 높아요.',
        opportunityScore: 81,
        recommendedAction: '정기 공구 제휴 논의하기',
        discoveredAt: '어제',
      },
    ],
  },
  {
    label: '니치 크리에이터',
    type: '니치 크리에이터',
    items: [
      {
        id: 'd-night-read',
        name: '밤의독서',
        handle: 'night.read',
        type: '니치 크리에이터',
        platform: 'blog',
        reason: '독서와 무드등을 엮은 감성 콘텐츠로, 스토리텔링 브랜드와 잘 맞아요.',
        opportunityScore: 83,
        recommendedAction: '감성 캠페인 제안하기',
        discoveredAt: '오늘',
      },
      {
        id: 'd-run-coffee',
        name: '러닝한잔',
        handle: 'run.and.coffee',
        type: '니치 크리에이터',
        platform: 'instagram',
        reason: '러닝과 카페를 엮은 니치로, 충성도 높은 커뮤니티를 갖고 있어요.',
        opportunityScore: 80,
        recommendedAction: '라이프스타일 협업 제안하기',
        discoveredAt: '어제',
      },
    ],
  },
];
