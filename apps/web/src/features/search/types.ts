/** Search feature types. Mock-only for now — no search engine is connected. */

/** Opportunity category a result belongs to. */
export type SearchResultType =
  '신규 브랜드' | '마이크로 크리에이터' | '브랜드 운영자' | '공구 셀러' | '니치 크리에이터';

/** Platform a result was surfaced on. */
export type SearchPlatform = 'instagram' | 'youtube' | 'tiktok' | 'blog';

export type SearchResult = {
  id: string;
  /** 이름 */
  name: string;
  /** @handle (optional secondary identifier) */
  handle?: string;
  /** 유형 */
  type: SearchResultType;
  /** 플랫폼 */
  platform: SearchPlatform;
  /** 발견 이유 — why Scout OS surfaced this opportunity. */
  reason: string;
  /** 기회 점수 (0–100) */
  opportunityScore: number;
  /** 추천 액션 — the next best move. */
  recommendedAction: string;
  /** Real profile image (Instagram creators only; mock items omit it). */
  profileImageUrl?: string | null;
  /** Follower count (real creators only). */
  followersCount?: number | null;
  /** AI recommendation reasons (data-derived) — shown instead of the raw score. */
  reasons?: string[];
  /** 바이오의 쇼핑몰/자사몰 링크 — 브랜드 카드에 🔗 칩으로 노출(진짜 브랜드 신호). */
  externalUrl?: string | null;
};

/** A user's judgement on a saved opportunity. */
export type OpportunityStatus = '미검토' | '관심' | '보류' | '제외' | '연락예정';

/**
 * Contact lifecycle status for a creator in the outreach flow (outreach_activities).
 * A superset of OpportunityStatus that adds the post-contact states.
 */
export type ContactStatus =
  '미검토' | '관심' | '보류' | '제외' | '연락예정' | '연락완료' | '답변옴';

/** A saved opportunity: the result plus the user's own classification. */
export type SavedOpportunity = SearchResult & {
  status: OpportunityStatus;
  note: string;
  /** epoch ms when it was saved (for stable ordering). */
  savedAt: number;
};
