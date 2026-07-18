import { type NextRequest } from 'next/server';

import { env } from '@/lib/env';
import { runRecurringBilling } from '@/services/billing/subscription-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/billing — charge subscriptions whose period ended, downgrade the
 * ones set to cancel. Protected by CRON_SECRET (Vercel Cron sends it as a Bearer
 * token). Runs daily; each due sub is charged at most once per period.
 */
export const GET = async (request: NextRequest) => {
  const secret = env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const summary = await runRecurringBilling(Date.now());
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    console.error(`[cron/billing] failed: ${String(err)}`);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
};
