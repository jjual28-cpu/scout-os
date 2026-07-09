import { type SearchResult } from './types';

/**
 * Static mock data for the Search experience. This is intentionally NOT wired to
 * any search engine — the goal of this milestone is the Search UX only.
 */

/** Rotating placeholder prompts shown in the big search input. */
export const SEARCH_PLACEHOLDERS = [
  '독서와 뷰티를 좋아하는 사람',
  '자신의 브랜드를 만든 인플루언서',
  '신규 뷰티 브랜드',
  '마이크로셀러',
  '키링 판매 셀러',
];

/** Seed values for "recent searches" before the user has searched anything. */
export const DEFAULT_RECENT_SEARCHES = [
  '신규 뷰티 브랜드',
  '자체 브랜드 운영 인플루언서',
  '소품 판매 마이크로셀러',
  '독서 + 뷰티 크리에이터',
  '공구 셀러',
];

/** The mock result set returned for any query. */
export const MOCK_RESULTS: SearchResult[] = [
  {
    id: 'r-glowleaf',
    name: '글로우리프',
    handle: 'glowleaf.official',
    type: '신규 브랜드',
    platform: 'instagram',
    reason:
      '최근 3개월간 팔로워가 2.1배 성장했고, 협업 파트너를 적극적으로 찾는 신호가 포착됐습니다.',
    opportunityScore: 92,
    recommendedAction: '브랜드 담당자에게 콜라보 제안 DM 보내기',
  },
  {
    id: 'r-min-beauty-log',
    name: '민 뷰티로그',
    handle: 'min_beauty_log',
    type: '마이크로 크리에이터',
    platform: 'instagram',
    reason: '참여율 8.4%로 동일 카테고리 평균의 3배. 소규모지만 전환력이 매우 높습니다.',
    opportunityScore: 88,
    recommendedAction: '제품 시딩 후 리뷰 콘텐츠 요청하기',
  },
  {
    id: 'r-seo-jihyun',
    name: '서지현',
    handle: 'jihyun.studio',
    type: '브랜드 운영자',
    platform: 'youtube',
    reason: '자체 스킨케어 브랜드를 운영 중이며, 리셀·공동 마케팅에 열려 있는 것으로 보입니다.',
    opportunityScore: 85,
    recommendedAction: '리셀 파트너십 미팅 제안하기',
  },
  {
    id: 'r-livedeal-shop',
    name: '라이브딜샵',
    handle: 'livedeal_shop',
    type: '공구 셀러',
    platform: 'instagram',
    reason: '월 4회 공동구매를 진행하며 회차마다 평균 완판. 즉각적인 매출 전환이 강점입니다.',
    opportunityScore: 83,
    recommendedAction: '신제품 공구 단독 물량 제안하기',
  },
  {
    id: 'r-reading-beauty',
    name: '책읽는뷰티',
    handle: 'read.and.beauty',
    type: '니치 크리에이터',
    platform: 'blog',
    reason: '독서와 뷰티를 결합한 감성 콘텐츠로, 스토리텔링 중심 브랜드와 적합도가 높습니다.',
    opportunityScore: 79,
    recommendedAction: '감성 캠페인 앰버서더로 제안하기',
  },
];
