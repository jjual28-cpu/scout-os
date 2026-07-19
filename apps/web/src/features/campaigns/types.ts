/** Execution state of a campaign's search run (system-set). */
export type CampaignStatus = 'running' | 'succeeded' | 'failed';

/** Workflow label (user-set): 🟢 진행중 / 🟡 보류 / 🔵 완료 / 🔴 실패. */
export type CampaignLabel = 'active' | 'hold' | 'done' | 'failed';

/** Where the campaign came from — manual search or (future) AI Engine. */
export type CampaignSource = 'manual' | 'ai';

/** Funnel KPIs — DERIVED at read time, never stored. */
export type CampaignSummary = {
  discovered: number;
  saved: number;
  dm: number;
  reply: number;
  collab: number;
  /** 협업 ÷ DM × 100, rounded. 0 when DM = 0. */
  conversion: number;
};

/** A derived "last activity" chip for the campaign list. */
export type CampaignLastAction = {
  kind: 'search' | 'dm' | 'reply' | 'collab' | 'saved';
  label: string; // e.g. "DM 4명 발송", "검색 완료"
  at: string; // ISO timestamp
};

/** Editable campaign metadata (Campaign 정보). */
export type CampaignMeta = {
  title: string;
  memo: string | null;
  brand: string | null;
  season: string | null;
  goal: string | null;
  productId: string | null;
  label: CampaignLabel;
};

/** A Campaign (Session) — the unit of the search → CRM → collab flow. */
export type Campaign = {
  id: string;
  title: string;
  query: string;
  platform: string;
  status: CampaignStatus;
  error: string | null;
  label: CampaignLabel;
  source: CampaignSource;
  memo: string | null;
  brand: string | null;
  season: string | null;
  goal: string | null;
  favorite: boolean;
  productId: string | null;
  productName: string | null;
  resultCount: number;
  createdAt: string;
  updatedAt: string;
  summary: CampaignSummary;
  lastAction: CampaignLastAction | null;
};

/** Snapshot of a creator as it appeared in a campaign's search. */
/** AI's judgement of whether a creator actually fits the brand/search intent. */
export type AiVerdict = 'fit' | 'maybe' | 'reject';

export type CampaignResult = {
  externalId: string;
  username: string;
  displayName: string;
  profileUrl: string;
  profileImageUrl: string | null;
  biography: string | null;
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  isVerified: boolean;
  category: string | null;
  /** 최근 활동(참여율 계산·트렌드 판정에 쓰임). 저장 스냅샷에 담겨 있다. */
  lastPostAt?: string | null;
  recentAvgLikes?: number | null;
  recentAvgComments?: number | null;
  /** 0~100 fit score. null when AI hasn't judged this result. */
  aiScore?: number | null;
  aiVerdict?: AiVerdict | null;
  /** One-line reason shown on the card. */
  aiReason?: string | null;
  /** 비주얼(이미지) 판정 — 옵션. null이면 아직 사진 판정 안 함. */
  visualScore?: number | null;
  visualVerdict?: AiVerdict | null;
  visualReason?: string | null;
};

/** A campaign "draft" carried into /discover for 다시 검색 / 복제 prefill. */
export type CampaignDraft = {
  title: string;
  query: string;
  brand: string | null;
  season: string | null;
  goal: string | null;
  memo: string | null;
  label: CampaignLabel;
  productId: string | null;
  /** Auto-run the search on arrival (다시 검색) vs. let the user edit first (복제). */
  autoRun: boolean;
};
