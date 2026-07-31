import { type NextRequest, NextResponse } from 'next/server';

import { customerKeyFor } from '@/features/billing/plans';
import { env, isTossConfigured } from '@/lib/env';
import { activatePaidPlan } from '@/services/billing/subscription-service';
import { issueBillingKey } from '@/services/billing/toss';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * GET /api/billing/callback — Toss redirects the browser here after the user
 * registers a card. We exchange authKey→billingKey, charge the first payment,
 * activate the plan, then bounce back to 설정 with a success/fail flag.
 * successUrl was `/api/billing/callback?plan=pro&cycle=monthly`.
 */
export const GET = async (request: NextRequest) => {
  const url = new URL(request.url);
  const back = (flag: 'success' | 'fail', extra = '') =>
    NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/settings?billing=${flag}${extra}`);

  try {
    if (!isTossConfigured()) return back('fail');

    const authKey = url.searchParams.get('authKey');
    const customerKey = url.searchParams.get('customerKey');
    const plan = url.searchParams.get('plan');
    const cycle = url.searchParams.get('cycle') === 'yearly' ? 'yearly' : 'monthly';
    if (!authKey || !customerKey || (plan !== 'basic' && plan !== 'pro')) return back('fail');

    const sb = await getSupabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    // The customerKey must belong to the signed-in user — never charge for someone else.
    if (!user || customerKey !== customerKeyFor(user.id)) return back('fail');

    const billingKey = await issueBillingKey(authKey, customerKey);
    await activatePaidPlan({
      userId: user.id,
      plan,
      cycle,
      billingKey,
      customerKey,
      ts: Date.now(),
    });
    // 성공 시 plan·cycle 을 넘겨 설정 화면에서 GA4 purchase 전환(매출값 포함)을 쏘게 한다.
    return back('success', `&plan=${plan}&cycle=${cycle}`);
  } catch (err) {
    console.error(`[billing] callback failed: ${String(err)}`);
    return back('fail');
  }
};
