import { z } from 'zod';

import { AnalysisKind } from '@scout-os/database';

export const analyzeCreatorInputSchema = z.object({
  creatorId: z.string().uuid(),
  kind: z.nativeEnum(AnalysisKind).default(AnalysisKind.FIT),
});

export type AnalyzeCreatorInput = z.infer<typeof analyzeCreatorInputSchema>;

/** Structured shape the AI analyst is asked to return. */
export const analysisResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  suggestedAngle: z.string().optional(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
