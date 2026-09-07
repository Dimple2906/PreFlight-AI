import { z } from 'zod';

export const StatusSchema = z.enum(['PASS', 'FAIL', 'WARN', 'SKIP', 'ERROR']);
export type Status = z.infer<typeof StatusSchema>;
export const PreflightStatusSchema = StatusSchema;
export type PreflightStatus = Status;

export const SeveritySchema = z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type Severity = z.infer<typeof SeveritySchema>;

export const ProjectLanguageSchema = z.enum([
  'typescript',
  'javascript',
  'python',
  'go',
  'rust',
  'java',
  'csharp',
  'ruby',
  'php',
  'unknown'
]);
export type ProjectLanguage = z.infer<typeof ProjectLanguageSchema>;

export const FrameworkSchema = z.enum([
  'nextjs',
  'express',
  'fastify',
  'nest',
  'vite',
  'react',
  'vue',
  'svelte',
  'remix',
  'nuxt',
  'django',
  'fastapi',
  'flask',
  'spring',
  'unknown'
]);
export type Framework = z.infer<typeof FrameworkSchema>;

export const RuntimeSchema = z.enum([
  'node',
  'bun',
  'deno',
  'python',
  'go',
  'java',
  'dotnet',
  'unknown'
]);
export type Runtime = z.infer<typeof RuntimeSchema>;

export const DatabaseSchema = z.enum([
  'postgresql',
  'mysql',
  'sqlite',
  'mongodb',
  'redis',
  'dynamodb',
  'none',
  'unknown'
]);
export type Database = z.infer<typeof DatabaseSchema>;

export const ArchitectureSchema = z.enum([
  'monolith',
  'monorepo',
  'microservices',
  'serverless',
  'jamstack',
  'unknown'
]);
export type Architecture = z.infer<typeof ArchitectureSchema>;

export const ProjectTypeSchema = z.enum([
  'web-app',
  'api-server',
  'cli-tool',
  'library',
  'fullstack',
  'unknown'
]);
export type ProjectType = z.infer<typeof ProjectTypeSchema>;

export const HostingProviderSchema = z.enum([
  'vercel',
  'netlify',
  'aws',
  'gcp',
  'azure',
  'docker',
  'railway',
  'render',
  'unknown'
]);
export type HostingProvider = z.infer<typeof HostingProviderSchema>;
