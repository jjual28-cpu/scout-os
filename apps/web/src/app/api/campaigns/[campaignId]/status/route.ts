import { type NextRequest } from 'next/server';

import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { isSupabaseConfigured } from '@/lib/env';
import { advanceCampaign } from '@/services/campaigns/advance';

export const dynamic = 'force-dynamic';
// Only reads a finished dataset + saves rows — never waits on an Apify run.
export const maxDuration = 60;

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

/**
 * POST /api/campaigns/:campaignId/status — advance the async search.
 *
 * POST (not GET) because this MUTATES: it collects a finished Apify dataset,
 * persists results and starts the next stage. Plain reads go straight to
 * Supabase from the client. The state machine itself lives in
 * services/campaigns/advance.ts (shared with the partner API).
 */
export const POST = withErrorHandling(
  async (_request: NextRequest, { params }: { params: { campaignId: string } }) => {
    const campaignId = params.campaignId;
    if (!isSupabaseConfigured()) return ok({ status: 'unavailable' as const });

    const sb = await getSupabase();
    const { data: auth } = await sb.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return ok({ status: 'unavailable' as const });

    const body = await advanceCampaign(sb, userId, campaignId);
    if ('notFound' in body) return fail('NOT_FOUND', '캠페인을 찾을 수 없습니다.', 404);
    return ok(body);
  },
);
