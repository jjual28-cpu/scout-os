'use client';

/**
 * GA4 + 구글 태그(gtag) 전송 헬퍼. 광고 클릭 → 가입 → 결제 전환 추적의 기반.
 * `NEXT_PUBLIC_GA_ID`(측정 ID, 예: G-XXXX) 없으면 전부 no-op — 로컬/미설정 안전.
 * GA4에서 sign_up·purchase 를 '전환'으로 표시하고 Google Ads 에 연동(가져오기)한다.
 */

/** GA4 측정 ID. 빌드 시 인라인되는 NEXT_PUBLIC 변수. */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

/* eslint-disable @typescript-eslint/no-explicit-any -- gtag 는 외부 전역 */
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** gtag 이벤트 전송(안전). ID 없거나 gtag 미로드면 아무 것도 안 함. */
export function track(event: string, params: Record<string, unknown> = {}): void {
  if (!GA_ID || typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', event, params);
}

/** 회원가입 전환. */
export const trackSignup = () => track('sign_up', { method: 'email' });

/** 검색(활성화 지표). */
export const trackSearch = (query?: string) => track('search', query ? { search_term: query } : {});

/** 유료 결제 전환 — 매출 값 포함(GA4·Ads 가치 기반 최적화용). */
export function trackPurchase(opts: { plan: string; value: number; cycle: string }): void {
  track('purchase', {
    value: opts.value,
    currency: 'KRW',
    items: [{ item_id: opts.plan, item_name: `${opts.plan}_${opts.cycle}` }],
  });
}
