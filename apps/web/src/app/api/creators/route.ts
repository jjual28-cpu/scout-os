import { type NextRequest } from 'next/server';

import { creatorFiltersSchema } from '@/features/discovery';
import { listCreators } from '@/features/discovery/services/discovery.service';
import { ok, withErrorHandling } from '@/lib/api/response';
import { requireSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/creators — paginated, filterable list of discovered creators.
 * Query params are coerced then validated against `creatorFiltersSchema`.
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const session = await requireSession();
  const sp = request.nextUrl.searchParams;

  const raw = {
    query: sp.get('query') ?? undefined,
    platforms: sp.get('platforms') ? JSON.parse(sp.get('platforms')!) : undefined,
    types: sp.get('types') ? JSON.parse(sp.get('types')!) : undefined,
    minFollowers: sp.get('minFollowers') ? Number(sp.get('minFollowers')) : undefined,
    maxFollowers: sp.get('maxFollowers') ? Number(sp.get('maxFollowers')) : undefined,
    minOpportunityScore: sp.get('minOpportunityScore')
      ? Number(sp.get('minOpportunityScore'))
      : undefined,
    sort: sp.get('sort') ? JSON.parse(sp.get('sort')!) : undefined,
    page: sp.get('page') ? Number(sp.get('page')) : undefined,
    pageSize: sp.get('pageSize') ? Number(sp.get('pageSize')) : undefined,
  };

  const filters = creatorFiltersSchema.parse(raw);
  const result = await listCreators(session.workspaceId, filters);
  return ok(result);
});
