import 'server-only';

import { Prisma, prisma } from '@scout-os/database';

import { type PaginatedResult } from '@/types/common';

import { type CreatorFilters } from '../schemas';
import { type CreatorSummary } from '../types';

/**
 * Server-side data-access layer for creator discovery. Route handlers and
 * Server Components call these functions; they never touch Prisma directly.
 * Everything is workspace-scoped for tenant isolation.
 */

function buildWhere(workspaceId: string, filters: CreatorFilters): Prisma.CreatorWhereInput {
  const where: Prisma.CreatorWhereInput = { workspaceId };
  const and: Prisma.CreatorWhereInput[] = [];

  if (filters.query) {
    and.push({
      OR: [
        { displayName: { contains: filters.query, mode: 'insensitive' } },
        { handle: { contains: filters.query, mode: 'insensitive' } },
        { bio: { contains: filters.query, mode: 'insensitive' } },
      ],
    });
  }
  if (filters.types?.length) where.type = { in: filters.types };
  if (filters.categories?.length) where.category = { in: filters.categories };
  if (filters.niches?.length) where.niches = { hasSome: filters.niches };
  if (filters.location) where.location = { contains: filters.location, mode: 'insensitive' };

  if (filters.minFollowers != null || filters.maxFollowers != null) {
    where.totalFollowers = {
      ...(filters.minFollowers != null ? { gte: filters.minFollowers } : {}),
      ...(filters.maxFollowers != null ? { lte: filters.maxFollowers } : {}),
    };
  }
  if (filters.minEngagement != null) where.avgEngagement = { gte: filters.minEngagement };
  if (filters.minOpportunityScore != null) {
    where.opportunityScore = { gte: filters.minOpportunityScore };
  }
  if (filters.platforms?.length) {
    where.socialAccounts = { some: { platform: { in: filters.platforms } } };
  }

  if (and.length) where.AND = and;
  return where;
}

export async function listCreators(
  workspaceId: string,
  filters: CreatorFilters,
): Promise<PaginatedResult<CreatorSummary>> {
  const where = buildWhere(workspaceId, filters);
  const { page, pageSize, sort } = filters;

  const [rows, total] = await Promise.all([
    prisma.creator.findMany({
      where,
      orderBy: { [sort.field]: sort.direction },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { socialAccounts: { select: { platform: true } } },
    }),
    prisma.creator.count({ where }),
  ]);

  const items: CreatorSummary[] = rows.map((c) => ({
    id: c.id,
    displayName: c.displayName,
    handle: c.handle,
    avatarUrl: c.avatarUrl,
    type: c.type,
    status: c.status,
    category: c.category,
    niches: c.niches,
    totalFollowers: c.totalFollowers,
    avgEngagement: c.avgEngagement,
    opportunityScore: c.opportunityScore,
    platforms: c.socialAccounts.map((a) => a.platform),
  }));

  return {
    items,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  };
}

export async function getCreator(workspaceId: string, creatorId: string) {
  return prisma.creator.findFirst({
    where: { id: creatorId, workspaceId },
    include: {
      socialAccounts: true,
      analyses: { orderBy: { createdAt: 'desc' } },
      tags: { include: { tag: true } },
    },
  });
}
