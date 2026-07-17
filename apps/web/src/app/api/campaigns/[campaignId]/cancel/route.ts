import { type NextRequest } from 'next/server';

import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * POST /api/campaigns/:campaignId/cancel — stop a running search.
 *
 * The escape hatch. Finishing a search normally depends on the browser poller
 * reaching the status route; if anything in that chain misbehaves the campaign
 * would sit on "검색 중" forever and — because of the one-running-per-query
 * unique index — block the user from searching that term again. This lets the
 * user (or the UI's own timeout) always take back control.
 *
 * RLS-scoped: only the owner's own running campaign can be cancelled.
 */
export const POST = withErrorHandling(
  async (_request: NextRequest, { params }: { params: { campaignId: string } }) => {
    if (!isSupabaseConfigured()) return fail('UNAVAILABLE', '서버가 구성되지 않았습니다.', 503);

    const sb = await getSupabase();
    const { data: auth } = await sb.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

    const { data } = await sb
      .from('campaigns')
      .update({
        status: 'failed',
        error: '검색을 중단했습니다. 다시 검색해 주세요.',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        apify_run_id: null, // releases the running-unique lock
      })
      .eq('id', params.campaignId)
      .eq('user_id', userId)
      .eq('status', 'running')
      .select('id');

    // Already finished/cancelled by another path — that's success from here.
    return ok({ cancelled: Boolean(data && data.length > 0) });
  },
);
