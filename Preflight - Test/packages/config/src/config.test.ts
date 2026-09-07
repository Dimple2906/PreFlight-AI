import { describe, it, expect } from 'vitest';
import { loadPreflightConfig, PreflightConfigSchema } from './config.js';

describe('Preflight Configuration', () => {
  it('should parse default configuration schema', () => {
    const config = PreflightConfigSchema.parse({});
    expect(config.ai.enabled).toBe(true);
    expect(config.ai.provider).toBe('mock');
    expect(config.execution.timeoutMs).toBe(30000);
    expect(config.execution.failFast).toBe(false);
  });

  it('should fallback to defaults when project root has no .preflightrc.json', async () => {
    const config = await loadPreflightConfig(process.cwd());
    expect(config.ai.enabled).toBe(true);
  });
});
