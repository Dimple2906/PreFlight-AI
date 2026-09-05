import { z } from 'zod';
import { SeveritySchema } from '@preflight/core';

export const FailureAnalysisSchema = z.object({
  resultId: z.string(),
  possibleRootCause: z.string(),
  risk: z.string(),
  impact: z.string(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  suggestedFix: z.string()
});
export type FailureAnalysisResult = z.infer<typeof FailureAnalysisSchema>;

export const QAGapItemSchema = z.object({
  id: z.string(),
  area: z.string(),
  description: z.string(),
  severity: SeveritySchema,
  recommendedAction: z.string(),
  suggestedCapabilityId: z.string().optional()
});

export const QAGapAnalysisSchema = z.object({
  summary: z.string(),
  rootCauseAnalyses: z.array(FailureAnalysisSchema).default([]),
  coverageGaps: z.array(QAGapItemSchema).default([]),
  additionalCheckRecommendations: z.array(z.object({
    id: z.string(),
    name: z.string(),
    reason: z.string(),
    command: z.string()
  })).default([])
});
export type QAGapAnalysisResult = z.infer<typeof QAGapAnalysisSchema>;

export const DeploymentGapAnalysisSchema = z.object({
  summary: z.string(),
  riskAssessment: z.string(),
  recommendedChecks: z.array(z.object({
    id: z.string(),
    name: z.string(),
    reason: z.string()
  })).default([])
});
export type DeploymentGapAnalysisResult = z.infer<typeof DeploymentGapAnalysisSchema>;

export const ProjectAnalysisSchema = z.object({
  summary: z.string(),
  detectedArchitectureRisk: z.string(),
  recommendedTestingStrategy: z.array(z.string()).default([])
});
export type ProjectAnalysisResult = z.infer<typeof ProjectAnalysisSchema>;
