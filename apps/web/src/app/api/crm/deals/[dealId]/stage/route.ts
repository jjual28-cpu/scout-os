import { type NextRequest } from 'next/server';

import { updateDealStageSchema } from '@/features/crm';
import { updateDealStage } from '@/features/crm/services/crm.service';
import { fail, ok, withErrorHandling } from '@/lib/api/response';
import { requireSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** PATCH /api/crm/deals/:dealId/stage — move a deal between pipeline columns. */
export const PATCH = withErrorHandling(
  async (request: NextRequest, { params }: { params: { dealId: string } }) => {
    const session = await requireSession();
    const body = await request.json();
    const input = updateDealStageSchema.parse({ ...body, dealId: params.dealId });

    const deal = await updateDealStage(session.workspaceId, input);
    if (!deal) return fail('NOT_FOUND', 'Deal not found', 404);
    return ok(deal);
  },
);
