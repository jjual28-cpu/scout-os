import { type NextRequest } from 'next/server';

import { generateDmInputSchema } from '@/features/outreach';
import { generateDm } from '@/features/outreach/services/outreach.service';
import { created, withErrorHandling } from '@/lib/api/response';
import { requireSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** POST /api/outreach/generate — draft an AI DM or follow-up for a deal. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await requireSession();
  const input = generateDmInputSchema.parse(await request.json());
  const message = await generateDm(session.workspaceId, input);
  return created(message);
});
