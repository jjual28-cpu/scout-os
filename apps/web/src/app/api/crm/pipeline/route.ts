import { type NextRequest } from 'next/server';

import { getPipeline } from '@/features/crm/services/crm.service';
import { ok, withErrorHandling } from '@/lib/api/response';
import { requireSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** GET /api/crm/pipeline — deals grouped by stage for the board. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const session = await requireSession();
  const campaignId = request.nextUrl.searchParams.get('campaignId') ?? undefined;
  const pipeline = await getPipeline(session.workspaceId, campaignId);
  return ok(pipeline);
});
