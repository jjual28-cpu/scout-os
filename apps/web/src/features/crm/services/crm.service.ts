import 'server-only';

import { ActivityType, DealStage, prisma } from '@scout-os/database';

import { type DealWithCreator, type PipelineColumns } from '../types';
import { type CreateDealInput, type UpdateDealStageInput } from '../schemas';

const creatorSelect = {
  id: true,
  displayName: true,
  handle: true,
  avatarUrl: true,
  opportunityScore: true,
} as const;

/** Load the full pipeline for a workspace, grouped into stage columns. */
export async function getPipeline(
  workspaceId: string,
  campaignId?: string,
): Promise<PipelineColumns> {
  const deals = await prisma.deal.findMany({
    where: { workspaceId, ...(campaignId ? { campaignId } : {}) },
    orderBy: [{ stage: 'asc' }, { position: 'asc' }],
    include: { creator: { select: creatorSelect } },
  });

  const columns = Object.fromEntries(
    Object.values(DealStage).map((stage) => [stage, [] as DealWithCreator[]]),
  ) as PipelineColumns;

  for (const deal of deals) columns[deal.stage].push(deal as DealWithCreator);
  return columns;
}

export async function createDeal(workspaceId: string, input: CreateDealInput) {
  const deal = await prisma.deal.create({
    data: { workspaceId, ...input },
  });
  await prisma.activity.create({
    data: { dealId: deal.id, type: ActivityType.DEAL_CREATED },
  });
  return deal;
}

/** Move a deal to a new stage and record the transition on the timeline. */
export async function updateDealStage(workspaceId: string, input: UpdateDealStageInput) {
  const existing = await prisma.deal.findFirst({
    where: { id: input.dealId, workspaceId },
    select: { stage: true },
  });
  if (!existing) return null;

  const deal = await prisma.deal.update({
    where: { id: input.dealId },
    data: {
      stage: input.stage,
      position: input.position,
      ...(input.stage === DealStage.COMPLETED ? { closedAt: new Date() } : {}),
    },
  });

  if (existing.stage !== input.stage) {
    await prisma.activity.create({
      data: {
        dealId: deal.id,
        type: ActivityType.STAGE_CHANGED,
        message: `${existing.stage} → ${input.stage}`,
      },
    });
  }
  return deal;
}
