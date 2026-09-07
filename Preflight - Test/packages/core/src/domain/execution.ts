import { z } from 'zod';
import { StatusSchema, SeveritySchema } from '../constants/enums.js';

export const ExecutionContextSchema = z.object({
  projectRoot: z.string(),
  environment: z.record(z.string()).default({}),
  timeoutMs: z.number().default(30000),
  failFast: z.boolean().default(false),
  logLevel: z.enum(['silent', 'normal', 'verbose', 'debug']).default('normal')
});
export type ExecutionContext = z.infer<typeof ExecutionContextSchema>;

export const EvidenceSchema = z.object({
  id: z.string(),
  command: z.string().optional(),
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().nullable(),
  durationMs: z.number(),
  artifacts: z.array(z.string()).default([]),
  capturedAt: z.string()
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const TestDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['adversarial', 'unit', 'integration', 'security', 'fuzz', 'boundary', 'concurrency']),
  command: z.string(),
  timeoutMs: z.number().default(30000),
  environment: z.record(z.string()).default({})
});
export type TestDefinition = z.infer<typeof TestDefinitionSchema>;

export const CheckDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['build', 'secret', 'dependency', 'docker', 'env', 'lint', 'typecheck', 'config']),
  command: z.string().optional(),
  checkerName: z.string().optional()
});
export type CheckDefinition = z.infer<typeof CheckDefinitionSchema>;

export const FindingSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  severity: SeveritySchema,
  status: StatusSchema,
  evidenceId: z.string().optional(),
  location: z.string().optional(),
  remediation: z.string().optional()
});
export type Finding = z.infer<typeof FindingSchema>;

export const ExecutionResultSchema = z.object({
  id: z.string(),
  targetId: z.string(),
  name: z.string(),
  type: z.enum(['test', 'check']),
  status: StatusSchema,
  severity: SeveritySchema,
  durationMs: z.number(),
  evidence: EvidenceSchema,
  explanation: z.string(),
  remediation: z.string().optional(),
  provenance: z.enum(['initial', 'ai-selected']).optional(),
  findings: z.array(FindingSchema).default([])
});
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
export type TestResult = ExecutionResult;
export type CheckResult = ExecutionResult;
