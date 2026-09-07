import { z } from 'zod';
import { SeveritySchema } from '../enums.js';

export const CoverageGapSchema = z.object({
  id: z.string(),
  area: z.string(),
  description: z.string(),
  severity: SeveritySchema,
  recommendedAction: z.string(),
  suggestedCheckCommand: z.string().optional()
});
export type CoverageGap = z.infer<typeof CoverageGapSchema>;

export const AIAnalysisSchema = z.object({
  summary: z.string(),
  rootCauseAnalyses: z.array(z.object({
    resultId: z.string(),
    possibleRootCause: z.string(),
    confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    suggestedFix: z.string()
  })),
  coverageGaps: z.array(CoverageGapSchema),
  additionalCheckRecommendations: z.array(z.object({
    id: z.string(),
    name: z.string(),
    reason: z.string(),
    command: z.string()
  })),
  sanitizedTokensCount: z.number().default(0),
  analyzedAt: z.string()
});
export type AIAnalysis = z.infer<typeof AIAnalysisSchema>;
