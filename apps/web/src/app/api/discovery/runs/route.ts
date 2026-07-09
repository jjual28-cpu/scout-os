import { type NextRequest } from 'next/server';

import { prisma, RunStatus } from '@scout-os/database';

import { discoveryRunInputSchema } from '@/features/discovery';
import { created, ok, withErrorHandling } from '@/lib/api/response';
import { requireSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/** GET /api/discovery/runs — recent discovery runs for the workspace. */
export const GET = withErrorHandling(async () => {
  const session = await requireSession();
  const runs = await prisma.discoveryRun.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return ok(runs);
});

/**
 * POST /api/discovery/runs — enqueue an AI discovery run from a NL brief.
 * Creates the run row synchronously; the actual discovery job is expected to be
 * picked up by a background worker (queue) that populates creators.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const session = await requireSession();
  const input = discoveryRunInputSchema.parse(await request.json());

  const run = await prisma.discoveryRun.create({
    data: {
      workspaceId: session.workspaceId,
      savedSearchId: input.savedSearchId,
      status: RunStatus.QUEUED,
      prompt: input.prompt,
      platforms: input.platforms,
      params: { types: input.types ?? [], targetCount: input.targetCount },
    },
  });

  // TODO: enqueue background discovery job (e.g. Redis/BullMQ) with run.id.

  return created(run);
});
