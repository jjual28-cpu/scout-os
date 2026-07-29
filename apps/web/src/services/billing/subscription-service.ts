import 'server-only';

import { PLANS, YEARLY_MONTHS_CHARGED, type PlanKey } from '@/features/billing/plans';
import { createAdminClient } from '@/lib/supabase/admin';

import { chargeBilling } from './toss';

/**
 * Server-side subscription lifecycle: first charge on upgrade, recurring charges
 * from the cron, and cancellation. All writes use the service-role client (the
 * subscriptions/payments tables are server-write-only). Charges go through Toss.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

function periodEnd(cycle: 'monthly' | 'yearly'): string {
  return addMonths(new Date(), cycle === 'yearly' ? 12 : 1).toISOString();
}

function amountFor(plan: PlanKey, cycle: 'monthly' | 'yearly'): number {
  const monthly = PLANS[plan].priceMonthly;
  // Yearly = YEARLY_MONTHS_CHARGED months' price (2 months free). Monthly = as listed.
  return cycle === 'yearly' ? monthly * YEARLY_MONTHS_CHARGED : monthly;
}

function orderId(userId: string, ts: number): string {
  return `scout_${userId.replace(/-/g, '').slice(0, 12)}_${ts}`;
}

async function logPayment(
  admin: any,
  row: {
    userId: string;
    plan: string;
    amount: number;
    cycle: string;
    status: 'paid' | 'failed';
    orderId: string;
    paymentKey?: string;
    raw: any;
  },
): Promise<void> {
  await admin.from('payments').insert({
    user_id: row.userId,
    plan: row.plan,
    amount: row.amount,
    billing_cycle: row.cycle,
    status: row.status,
    provider: 'toss',
    order_id: row.orderId,
    payment_key: row.paymentKey ?? null,
    raw: row.raw ?? null,
  });
}

/**
 * Charge the first payment and activate a paid plan. `ts` is passed in (routes
 * have a real clock) so the orderId is deterministic per call. Throws on charge
 * failure — the caller redirects the user to a failure screen.
 */
export async function activatePaidPlan(args: {
  userId: string;
  plan: PlanKey;
  cycle: 'monthly' | 'yearly';
  billingKey: string;
  customerKey: string;
  ts: number;
}): Promise<void> {
  const { userId, plan, cycle, billingKey, customerKey, ts } = args;
  const admin = createAdminClient();
  const amount = amountFor(plan, cycle);
  const oid = orderId(userId, ts);

  let result;
  try {
    result = await chargeBilling(billingKey, {
      customerKey,
      amount,
      orderId: oid,
      orderName: `Scout OS ${PLANS[plan].name} (${cycle === 'yearly' ? '연간' : '월간'})`,
    });
  } catch (err) {
    await logPayment(admin, {
      userId,
      plan,
      amount,
      cycle,
      status: 'failed',
      orderId: oid,
      raw: { error: String(err) },
    });
    throw err;
  }

  // Don't activate on a charge that didn't actually complete.
  if (!result.ok) throw new Error('결제가 완료되지 않았습니다.');

  const { error: upErr } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      plan,
      status: 'active',
      billing_cycle: cycle,
      current_period_end: periodEnd(cycle),
      provider: 'toss',
      provider_billing_key: billingKey,
      customer_key: customerKey,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  // A silent upsert failure (e.g. missing migration) must NOT report success —
  // otherwise the user is charged but the plan never activates.
  if (upErr) throw new Error(`구독 활성화 실패: ${upErr.message}`);

  await logPayment(admin, {
    userId,
    plan,
    amount,
    cycle,
    status: 'paid',
    orderId: oid,
    paymentKey: result.paymentKey,
    raw: result.raw,
  });
}

/** Mark a subscription to end at the current period (no more charges). */
export async function cancelAtPeriodEnd(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from('subscriptions')
    .update({
      cancel_at_period_end: true,
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
}

/**
 * Cron: charge every active subscription whose period has ended, and downgrade
 * the ones that were set to cancel. Best-effort per row — one failure marks that
 * sub past_due and moves on. Returns a summary for the cron response.
 */
export async function runRecurringBilling(
  ts: number,
): Promise<{ charged: number; downgraded: number; failed: number }> {
  const admin = createAdminClient();
  const nowIso = new Date(ts).toISOString();
  const { data } = await admin
    .from('subscriptions')
    .select('user_id,plan,billing_cycle,provider_billing_key,customer_key,cancel_at_period_end')
    .neq('plan', 'free')
    .lte('current_period_end', nowIso);

  let charged = 0,
    downgraded = 0,
    failed = 0;

  for (const s of (data as any[] | null) ?? []) {
    // Cancellation requested → drop to free at period end.
    if (s.cancel_at_period_end) {
      await admin
        .from('subscriptions')
        .update({ plan: 'free', status: 'canceled', updated_at: nowIso })
        .eq('user_id', s.user_id);
      downgraded++;
      continue;
    }
    const plan = s.plan as PlanKey;
    const cycle = (s.billing_cycle === 'yearly' ? 'yearly' : 'monthly') as 'monthly' | 'yearly';
    const amount = amountFor(plan, cycle);
    const oid = orderId(s.user_id, ts);
    try {
      const result = await chargeBilling(s.provider_billing_key, {
        customerKey: s.customer_key,
        amount,
        orderId: oid,
        orderName: `Scout OS ${PLANS[plan].name} 갱신`,
      });
      if (!result.ok) throw new Error('charge not DONE');
      await admin
        .from('subscriptions')
        .update({ current_period_end: periodEnd(cycle), status: 'active', updated_at: nowIso })
        .eq('user_id', s.user_id);
      await logPayment(admin, {
        userId: s.user_id,
        plan,
        amount,
        cycle,
        status: 'paid',
        orderId: oid,
        paymentKey: result.paymentKey,
        raw: result.raw,
      });
      charged++;
    } catch (err) {
      await admin
        .from('subscriptions')
        .update({ status: 'past_due', updated_at: nowIso })
        .eq('user_id', s.user_id);
      await logPayment(admin, {
        userId: s.user_id,
        plan,
        amount,
        cycle,
        status: 'failed',
        orderId: oid,
        raw: { error: String(err) },
      });
      failed++;
    }
  }
  return { charged, downgraded, failed };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
