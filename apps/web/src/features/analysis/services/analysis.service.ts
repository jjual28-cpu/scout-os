import 'server-only';

import { prisma } from '@scout-os/database';

import { getAiProvider, prompts } from '@/services/ai';
import { AppError } from '@/lib/api/response';

import { analysisResultSchema, type AnalyzeCreatorInput } from '../schemas';

/**
 * Runs an AI analysis for a creator, persists it as an `AiAnalysis` row, and
 * denormalises the score onto the creator for fast sorting. Workspace-scoped.
 */
export async function analyzeCreator(workspaceId: string, input: AnalyzeCreatorInput) {
  const creator = await prisma.creator.findFirst({
    where: { id: input.creatorId, workspaceId },
  });
  if (!creator) throw new AppError('NOT_FOUND', 'Creator not found', 404);

  const ai = getAiProvider();
  const result = await ai.generate({
    system: prompts.SYSTEM_ANALYST,
    messages: [{ role: 'user', content: prompts.creatorAnalysisPrompt(creator) }],
    json: true,
  });

  // The provider returns JSON text; validate it before trusting it.
  const parsed = analysisResultSchema.safeParse(safeJsonParse(result.text));
  const data = parsed.success
    ? parsed.data
    : { score: creator.opportunityScore ?? 0, summary: result.text, strengths: [], risks: [] };

  const [analysis] = await prisma.$transaction([
    prisma.aiAnalysis.create({
      data: {
        creatorId: creator.id,
        kind: input.kind,
        model: result.model,
        score: data.score,
        summary: data.summary,
        result: data,
      },
    }),
    prisma.creator.update({
      where: { id: creator.id },
      data: { opportunityScore: data.score },
    }),
  ]);

  return analysis;
}

export async function listAnalyses(workspaceId: string, creatorId: string) {
  return prisma.aiAnalysis.findMany({
    where: { creatorId, creator: { workspaceId } },
    orderBy: { createdAt: 'desc' },
  });
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
