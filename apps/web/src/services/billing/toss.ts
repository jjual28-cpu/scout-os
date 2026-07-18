import 'server-only';

import { env } from '@/lib/env';

/**
 * Toss Payments 정기결제(빌링) API. Two server-only calls:
 *   1. 카드 등록 authKey → billingKey 발급 (issueBillingKey)
 *   2. billingKey 로 실제 청구 (chargeBilling)
 * The secret key never leaves the server. Throws on any non-OK response so the
 * caller can surface a failure (never silently "succeed" a charge that didn't).
 */

const BASE = 'https://api.tosspayments.com/v1';

function authHeader(): string {
  const key = env.TOSS_SECRET_KEY;
  if (!key) throw new Error('TOSS_SECRET_KEY is not configured');
  // Basic base64("secretKey:")  — Toss uses the secret key as the username, empty password.
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- external API JSON */
async function tossPost(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.message || `토스 결제 오류 (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

/** Exchange the card-registration authKey for a reusable billingKey. */
export async function issueBillingKey(authKey: string, customerKey: string): Promise<string> {
  const json = await tossPost('/billing/authorizations/issue', { authKey, customerKey });
  const billingKey = json?.billingKey;
  if (typeof billingKey !== 'string' || !billingKey) throw new Error('빌링키 발급에 실패했습니다.');
  return billingKey;
}

export type ChargeResult = {
  ok: boolean;
  orderId: string;
  paymentKey?: string;
  raw: any;
};

/** Charge a stored card via its billingKey. `orderId` must be unique per charge. */
export async function chargeBilling(
  billingKey: string,
  params: { customerKey: string; amount: number; orderId: string; orderName: string },
): Promise<ChargeResult> {
  const json = await tossPost(`/billing/${encodeURIComponent(billingKey)}`, {
    customerKey: params.customerKey,
    amount: params.amount,
    orderId: params.orderId,
    orderName: params.orderName,
  });
  return {
    ok: json?.status === 'DONE',
    orderId: params.orderId,
    paymentKey: json?.paymentKey,
    raw: json,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
