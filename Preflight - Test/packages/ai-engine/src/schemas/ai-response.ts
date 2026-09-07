import { z } from 'zod';
import { SeveritySchema } from '@preflight/core';

// --- Context Schemas (Input to AI) ---

export const ProjectContextSchema = z.object({
  name: z.string(),
  projectType: z.string(),
  languages: z.array(z.string()),
  frameworks: z.array(z.string()),
  runtime: z.string(),
  databases: z.array(z.string()),
  packageManager: z.string(),
  architecture: z.string(),
  hosting: z.array(z.string()),
  hasDockerfile: z.boolean(),
  hasCIConfig: z.boolean(),
  domainSignals: z.array(z.string()),
  dependenciesCount: z.number(),
  devDependenciesCount: z.number(),
  riskSignals: z.array(z.string()).default([])
});
export type ProjectContext = z.infer<typeof ProjectContextSchema>;

export const TestPlanningContextSchema = z.object({
  projectContext: ProjectContextSchema,
  availableCapabilities: z.array(z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    description: z.string()
  }))
});
export type TestPlanningContext = z.infer<typeof TestPlanningContextSchema>;

export const SanitizedEvidenceItemSchema = z.object({
  testId: z.string(),
  name: z.string(),
  status: z.enum(['PASS', 'FAIL', 'WARN', 'SKIP', 'ERROR']),
  durationMs: z.number(),
  severity: z.string(),
  explanation: z.string(),
  evidence: z.object({
    command: z.string().optional(),
    exitCode: z.number().nullable().optional(),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    httpStatus: z.number().optional()
  })
});
export type SanitizedEvidenceItem = z.infer<typeof SanitizedEvidenceItemSchema>;

export const EvidenceContextSchema = z.object({
  projectContext: ProjectContextSchema,
  executedResults: z.array(SanitizedEvidenceItemSchema)
});
export type EvidenceContext = z.infer<typeof EvidenceContextSchema>;

export const GapAnalysisContextSchema = z.object({
  projectContext: ProjectContextSchema,
  executedResults: z.array(SanitizedEvidenceItemSchema),
  uncoveredSignals: z.array(z.string()),
  availableCapabilities: z.array(z.object({
    id: z.string(),
    name: z.string(),
    category: z.string()
  }))
});
export type GapAnalysisContext = z.infer<typeof GapAnalysisContextSchema>;

// --- Output Schemas (Responses from AI) ---

export const ProjectAnalysisSchema = z.object({
  summary: z.string(),
  detectedArchitectureRisk: z.string(),
  riskSignals: z.array(z.string()).default([]),
  recommendedTestingStrategy: z.array(z.string()).default([])
});
export type ProjectAnalysis = z.infer<typeof ProjectAnalysisSchema>;

export const AIRecommendedTestSchema = z.object({
  id: z.string(),
  category: z.string(),
  title: z.string(),
  objective: z.string(),
  rationale: z.string(),
  risk: z.enum(['low', 'medium', 'high', 'critical']),
  target: z.string().optional(),
  prerequisites: z.array(z.string()).optional()
});
export type AIRecommendedTest = z.infer<typeof AIRecommendedTestSchema>;

export const TestPlanSchema = z.object({
  summary: z.string(),
  recommendedTests: z.array(AIRecommendedTestSchema).default([])
});
export type TestPlan = z.infer<typeof TestPlanSchema>;

export const FailureAnalysisSchema = z.object({
  resultId: z.string(),
  possibleRootCause: z.string(),
  risk: z.string(),
  impact: z.string(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  suggestedFix: z.string()
});
export type FailureAnalysis = z.infer<typeof FailureAnalysisSchema>;

export const CoverageGapSchema = z.object({
  id: z.string(),
  area: z.string(),
  description: z.string(),
  severity: SeveritySchema,
  recommendedAction: z.string(),
  suggestedCapabilityId: z.string().optional()
});
export type CoverageGap = z.infer<typeof CoverageGapSchema>;

export const EvidenceAnalysisSchema = z.object({
  summary: z.string(),
  rootCauseAnalyses: z.array(FailureAnalysisSchema).default([]),
  coverageGaps: z.array(CoverageGapSchema).default([]),
  remediationRecommendations: z.array(z.object({
    area: z.string(),
    action: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical'])
  })).default([])
});
export type EvidenceAnalysis = z.infer<typeof EvidenceAnalysisSchema>;

export const TestRecommendationSchema = z.object({
  id: z.string(),
  category: z.string(),
  title: z.string(),
  rationale: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  capabilityId: z.string().optional()
});
export type TestRecommendation = z.infer<typeof TestRecommendationSchema>;

export const QAGapAnalysisSchema = z.object({
  summary: z.string(),
  rootCauseAnalyses: z.array(FailureAnalysisSchema).default([]),
  coverageGaps: z.array(CoverageGapSchema).default([]),
  additionalCheckRecommendations: z.array(z.object({
    id: z.string(),
    name: z.string(),
    reason: z.string(),
    command: z.string().optional()
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
