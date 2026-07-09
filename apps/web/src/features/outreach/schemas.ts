import { z } from 'zod';

import { MessageKind } from '@scout-os/database';

export const toneEnum = z.enum(['friendly', 'professional', 'casual']);

/** Ask the AI to draft a first-contact DM for a deal. */
export const generateDmInputSchema = z.object({
  dealId: z.string().uuid(),
  kind: z.nativeEnum(MessageKind).default(MessageKind.DM),
  tone: toneEnum.default('friendly'),
  angle: z.string().max(300).optional(),
  brandName: z.string().max(120).optional(),
});

export type GenerateDmInput = z.infer<typeof generateDmInputSchema>;

/** Persist / edit an outreach message draft. */
export const saveMessageSchema = z.object({
  dealId: z.string().uuid(),
  kind: z.nativeEnum(MessageKind).default(MessageKind.DM),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(4000),
  scheduledAt: z.coerce.date().optional(),
});

export type SaveMessageInput = z.infer<typeof saveMessageSchema>;
