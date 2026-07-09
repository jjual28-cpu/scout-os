import 'server-only';

import { MessageKind, MessageStatus, prisma } from '@scout-os/database';

import { getAiProvider, prompts } from '@/services/ai';
import { AppError } from '@/lib/api/response';

import { type GenerateDmInput, type SaveMessageInput } from '../schemas';

/**
 * Generates an AI outreach draft (DM or follow-up) for a deal and stores it as a
 * DRAFT message. The team reviews/edits before anything is sent.
 */
export async function generateDm(workspaceId: string, input: GenerateDmInput) {
  const deal = await prisma.deal.findFirst({
    where: { id: input.dealId, workspaceId },
    include: { creator: true, campaign: true },
  });
  if (!deal) throw new AppError('NOT_FOUND', 'Deal not found', 404);

  const ai = getAiProvider();
  const isFollowUp = input.kind === MessageKind.FOLLOW_UP;

  const prompt = isFollowUp
    ? `크리에이터 "${deal.creator.displayName}"에게 답장이 없어 정중한 팔로업 메시지를 작성해줘. 2문장 이내.`
    : prompts.outreachDmPrompt({
        creatorName: deal.creator.displayName,
        brandName: input.brandName ?? deal.campaign?.name ?? 'our brand',
        angle: input.angle ?? '신제품 협업',
        tone: input.tone,
      });

  const result = await ai.generate({
    system: prompts.SYSTEM_OUTREACH,
    messages: [{ role: 'user', content: prompt }],
  });

  return prisma.outreachMessage.create({
    data: {
      dealId: deal.id,
      kind: input.kind,
      status: MessageStatus.DRAFT,
      body: result.text,
      aiMeta: { model: result.model, tone: input.tone, generated: true },
    },
  });
}

export async function saveMessage(workspaceId: string, input: SaveMessageInput) {
  const deal = await prisma.deal.findFirst({
    where: { id: input.dealId, workspaceId },
    select: { id: true },
  });
  if (!deal) throw new AppError('NOT_FOUND', 'Deal not found', 404);

  return prisma.outreachMessage.create({
    data: {
      dealId: input.dealId,
      kind: input.kind,
      subject: input.subject,
      body: input.body,
      scheduledAt: input.scheduledAt,
      status: input.scheduledAt ? MessageStatus.SCHEDULED : MessageStatus.DRAFT,
    },
  });
}

export async function listMessages(workspaceId: string, dealId: string) {
  return prisma.outreachMessage.findMany({
    where: { dealId, deal: { workspaceId } },
    orderBy: { createdAt: 'desc' },
  });
}
