import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function detectDefaultAIProvider(): 'gemini' | 'mock' {
  if (process.env.PREFLIGHT_AI_PROVIDER === 'gemini') return 'gemini';
  if (process.env.PREFLIGHT_AI_PROVIDER === 'mock') return 'mock';
  if (process.env.VITEST && !process.env.PREFLIGHT_FORCE_AI) return 'mock';
  const key = process.env.GEMINI_API_KEY;
  if (key && key.trim().length > 0) return 'gemini';
  return 'mock';
}

export const PreflightConfigSchema = z.object({
  ai: z.object({
    enabled: z.boolean().default(true),
    provider: z.enum(['mock', 'gemini']).default('mock'),
    modelName: z.string().default('gemini-3.6-flash'),
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
  let loadedConfig: any = {};
  if (fs.existsSync(rcPath)) {
    try {
      const raw = fs.readFileSync(rcPath, 'utf-8');
      loadedConfig = JSON.parse(raw);
    } catch (err) {
      console.warn(`[PreFlight Config Warning] Invalid .preflightrc.json at ${rcPath}. Falling back to default configuration.`);
    }
  }
  const parsed = PreflightConfigSchema.parse(loadedConfig);
  if (!loadedConfig?.ai?.provider) {
    parsed.ai.provider = detectDefaultAIProvider();
  }
  return parsed;
}
