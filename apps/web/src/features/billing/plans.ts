/**
 * Plan catalog — the single source of truth for names, search limits and prices.
 * Pure data (no server-only) so the settings UI and, later, server-side
 * enforcement both read the same numbers. Change a limit here, not in two places.
 *
 * Phase 1 only DISPLAYS these; the free-search block and real payment come in
 * phase 2 (Toss 정기결제).
 */
export type PlanKey = 'free' | 'basic' | 'pro';

export type Plan = {
  key: PlanKey;
  name: string;
  /** Searches allowed per calendar month. */
  monthlySearches: number;
  /** Won per month (0 = free). Annual pricing is decided in phase 2. */
  priceMonthly: number;
  tagline: string;
};

export const PLANS: Record<PlanKey, Plan> = {
  free: { key: 'free', name: '무료', monthlySearches: 1, priceMonthly: 0, tagline: '맛보기 1회' },
  basic: {
    key: 'basic',
    name: '베이직',
    monthlySearches: 100,
    priceMonthly: 19800,
    tagline: '월 100회 검색',
  },
  pro: {
    key: 'pro',
    name: '프로',
    monthlySearches: 300,
    priceMonthly: 39800,
    tagline: '월 300회 검색',
  },
};

export const PLAN_ORDER: PlanKey[] = ['free', 'basic', 'pro'];

/**
 * 연간 결제 시 청구하는 개월 수 — 12개월 중 2개월 무료(= 월가 × 10).
 * 서버의 실제 청구액(amountFor)과 클라의 표시가 어긋나면 안 되므로 여기 한 곳에서 정한다.
 */
export const YEARLY_MONTHS_CHARGED = 10;

/** 연간 결제 금액(원). */
export function priceYearly(plan: Plan): number {
  return plan.priceMonthly * YEARLY_MONTHS_CHARGED;
}

/** Coerce any stored/unknown value to a valid plan (defaults to free). */
export function toPlanKey(value: unknown): PlanKey {
  return value === 'basic' || value === 'pro' ? value : 'free';
}

/** "19,800원" / "무료". */
export function formatPrice(won: number): string {
  return won === 0 ? '무료' : `${won.toLocaleString('ko-KR')}원`;
}

/**
 * Toss customerKey for a user — derived identically on the client (card
 * registration) and the server (charge), so they always match. Alphanumeric.
 */
export function customerKeyFor(userId: string): string {
  return `scout_${userId.replace(/-/g, '')}`;
}
