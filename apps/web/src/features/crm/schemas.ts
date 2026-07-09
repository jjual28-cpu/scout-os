import { z } from 'zod';

import { DealStage, Priority } from '@scout-os/database';

export const dealStageEnum = z.nativeEnum(DealStage);
export const priorityEnum = z.nativeEnum(Priority);

/** Ordered pipeline columns, left → right. Drives the board UI. */
export const PIPELINE_STAGES: { stage: DealStage; label: string }[] = [
  { stage: DealStage.PROSPECT, label: '후보' },
  { stage: DealStage.CONTACTED, label: '컨택' },
  { stage: DealStage.REPLIED, label: '응답' },
  { stage: DealStage.NEGOTIATING, label: '협의' },
  { stage: DealStage.AGREED, label: '합의' },
  { stage: DealStage.IN_PROGRESS, label: '진행' },
  { stage: DealStage.COMPLETED, label: '완료' },
];

export const createDealSchema = z.object({
  creatorId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  stage: dealStageEnum.default(DealStage.PROSPECT),
  value: z.number().int().min(0).optional(),
  priority: priorityEnum.default(Priority.MEDIUM),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;

export const updateDealStageSchema = z.object({
  dealId: z.string().uuid(),
  stage: dealStageEnum,
  position: z.number().int().min(0).default(0),
});

export type UpdateDealStageInput = z.infer<typeof updateDealStageSchema>;
