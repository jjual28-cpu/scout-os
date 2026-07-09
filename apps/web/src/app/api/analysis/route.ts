import { type NextRequest } from 'next/server';

import { analyzeCreatorInputSchema } from '@/features/analysis';
import { analyzeCreator } from '@/features/analysis/services/analysis.service';
import { created, withErrorHandling } from '@/lib/api/response';
import { requireSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** POST /api/analysis — run an AI analysis for a creator. */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await requireSession();
  const input = analyzeCreatorInputSchema.parse(await request.json());
  const analysis = await analyzeCreator(session.workspaceId, input);
  return created(analysis);
});
