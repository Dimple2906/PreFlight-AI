import { z } from 'zod';
import {
  ProjectLanguageSchema,
  FrameworkSchema,
  RuntimeSchema,
  DatabaseSchema,
  ArchitectureSchema,
  ProjectTypeSchema,
  HostingProviderSchema
} from '../enums.js';

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
  packageManager: z.enum(['npm', 'pnpm', 'yarn', 'bun', 'pip', 'cargo', 'go', 'unknown']),
  hasDockerfile: z.boolean(),
  hasCIConfig: z.boolean(),
  entrypoints: z.array(z.string()),
  testFrameworks: z.array(z.string()),
  envFiles: z.array(z.string()),
  dependencies: z.record(z.string()),
  devDependencies: z.record(z.string()).default({})
});

export type ProjectProfile = z.infer<typeof ProjectProfileSchema>;
