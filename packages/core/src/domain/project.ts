import { z } from 'zod';
import {
  ProjectLanguageSchema,
  FrameworkSchema,
  RuntimeSchema,
  DatabaseSchema,
  ArchitectureSchema,
  ProjectTypeSchema,
  HostingProviderSchema
} from '../constants/enums.js';

export const DetectionEvidenceSchema = z.object({
  feature: z.string(),
  value: z.string(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  sourceFile: z.string(),
  reason: z.string()
});
export type DetectionEvidence = z.infer<typeof DetectionEvidenceSchema>;

export const DomainSignalSchema = z.enum([
  'auth',
  'payments',
  'e-commerce',
  'file-uploads',
  'databases',
  'external-api'
]);
export type DomainSignal = z.infer<typeof DomainSignalSchema>;

export const ProjectProfileSchema = z.object({
  name: z.string(),
  rootPath: z.string(),
  languages: z.array(ProjectLanguageSchema),
  frameworks: z.array(FrameworkSchema),
  runtime: RuntimeSchema,
  databases: z.array(DatabaseSchema),
  architecture: ArchitectureSchema,
  projectType: ProjectTypeSchema,
  hosting: z.array(HostingProviderSchema),
  packageManager: z.enum(['npm', 'pnpm', 'yarn', 'bun', 'pip', 'poetry', 'maven', 'gradle', 'cargo', 'go', 'unknown']),
  hasDockerfile: z.boolean(),
  hasCIConfig: z.boolean(),
  entrypoints: z.array(z.string()),
  testFrameworks: z.array(z.string()),
  envFiles: z.array(z.string()),
  dependencies: z.record(z.string()),
  devDependencies: z.record(z.string()).default({}),
  domainSignals: z.array(DomainSignalSchema).default([]),
  evidenceList: z.array(DetectionEvidenceSchema).default([])
});

export type ProjectProfile = z.infer<typeof ProjectProfileSchema>;
