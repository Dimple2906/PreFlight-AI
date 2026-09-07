import { z } from 'zod';
import { SeveritySchema } from '../constants/enums.js';

export const CoverageGapSchema = z.object({
  id: z.string(),
  area: z.string(),
  description: z.string(),
  severity: SeveritySchema,
  recommendedAction: z.string(),
  suggestedCapabilityId: z.string().optional(),
  suggestedCheckCommand: z.string().optional()
});
export type CoverageGap = z.infer<typeof CoverageGapSchema>;

export const AIRecommendedPlanItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  title: z.string(),
  objective: z.string(),
  rationale: z.string(),
  risk: z.string(),
  status: z.enum(['APPROVED', 'SKIPPED', 'EXECUTED']).default('APPROVED'),
  skipReason: z.string().optional()
});
export type AIRecommendedPlanItem = z.infer<typeof AIRecommendedPlanItemSchema>;

export const AIRiskAnalysisRecordSchema = z.object({
  summary: z.string(),
  detectedArchitectureRisk: z.string(),
  riskSignals: z.array(z.string()).default([]),
  recommendedTestingStrategy: z.array(z.string()).default([])
});
export type AIRiskAnalysisRecord = z.infer<typeof AIRiskAnalysisRecordSchema>;

export const AIAnalysisSchema = z.object({
  summary: z.string(),
  provider: z.enum(['gemini', 'mock']).optional(),
  status: z.enum(['available', 'unavailable', 'disabled']).optional(),
  riskAnalysis: AIRiskAnalysisRecordSchema.optional(),
  testPlan: z.array(AIRecommendedPlanItemSchema).optional(),
  rootCauseAnalyses: z.array(z.object({
    resultId: z.string(),
    possibleRootCause: z.string(),
    confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    suggestedFix: z.string()
  })).default([]),
  coverageGaps: z.array(CoverageGapSchema).default([]),
  additionalCheckRecommendations: z.array(z.object({
    id: z.string(),
    name: z.string(),
    reason: z.string(),
    command: z.string().optional()
  })).default([]),
  sanitizedTokensCount: z.number().default(0),
  analyzedAt: z.string()
});
export type AIAnalysis = z.infer<typeof AIAnalysisSchema>;
