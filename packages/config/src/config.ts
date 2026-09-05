import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const PreflightConfigSchema = z.object({
  ai: z.object({
    enabled: z.boolean().default(true),
    provider: z.enum(['mock', 'gemini']).default('mock'),
    modelName: z.string().default('gemini-2.5-flash'),
    apiKeyEnvVar: z.string().default('GEMINI_API_KEY')
  }).default({}),
  execution: z.object({
    timeoutMs: z.number().default(30000),
    maxConcurrency: z.number().default(4),
    failFast: z.boolean().default(false)
  }).default({}),
  ignorePatterns: z.array(z.string()).default(['**/node_modules/**', '**/.git/**', '**/dist/**'])
});

export type PreflightConfig = z.infer<typeof PreflightConfigSchema>;

export async function loadPreflightConfig(projectRoot: string): Promise<PreflightConfig> {
  const rcPath = path.join(projectRoot, '.preflightrc.json');
  if (fs.existsSync(rcPath)) {
    try {
      const raw = fs.readFileSync(rcPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return PreflightConfigSchema.parse(parsed);
    } catch (err) {
      console.warn(`[PreFlight Config Warning] Invalid .preflightrc.json at ${rcPath}. Falling back to default configuration.`);
    }
  }
  return PreflightConfigSchema.parse({});
}
