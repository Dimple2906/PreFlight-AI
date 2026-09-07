import { z } from 'zod';
import { PreflightStatusSchema } from '../enums.js';
import { ProjectProfileSchema } from './project.js';
import { ExecutionResultSchema } from './execution.js';
import { AIAnalysisSchema } from './ai.js';

export const SummaryStatsSchema = z.object({
  total: z.number(),
  passed: z.number(),
  failed: z.number(),
  warned: z.number(),
  skipped: z.number(),
  errored: z.number(),
  durationMs: z.number()
});
export type SummaryStats = z.infer<typeof SummaryStatsSchema>;

export const FinalReportSchema = z.object({
  reportId: z.string(),
  mode: z.enum(['test', 'deploy']),
  overallStatus: PreflightStatusSchema,
  projectProfile: ProjectProfileSchema,
  results: z.array(ExecutionResultSchema),
  stats: SummaryStatsSchema,
  aiAnalysis: AIAnalysisSchema.optional(),
  generatedAt: z.string()
});
export type FinalReport = z.infer<typeof FinalReportSchema>;
