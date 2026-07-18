'use client';

/* eslint-disable @typescript-eslint/no-explicit-any -- external SDK is untyped */
declare global {
  interface Window {
    TossPayments?: (clientKey: string) => any;
  }
}

/** Load the Toss Payments browser SDK once and return an instance. */
export async function loadToss(clientKey: string): Promise<any> {
  if (typeof window === 'undefined') throw new Error('client only');
  if (!window.TossPayments) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.tosspayments.com/v1/payment';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('토스 결제 모듈을 불러오지 못했어요.'));
      document.head.appendChild(s);
    });
  }
  if (!window.TossPayments) throw new Error('토스 결제 모듈을 불러오지 못했어요.');
  return window.TossPayments(clientKey);
}
/* eslint-enable @typescript-eslint/no-explicit-any */
