import { describe, it, expect } from 'vitest';
import {
  ProjectProfileSchema,
  TestDefinitionSchema,
  CheckDefinitionSchema,
  ExecutionContextSchema,
  EvidenceSchema,
  ExecutionResultSchema,
  FinalReportSchema,
  StatusSchema,
  SeveritySchema
} from '../index.js';

describe('Core Domain Schemas', () => {
  it('should parse valid Status and Severity values', () => {
    expect(StatusSchema.parse('PASS')).toBe('PASS');
    expect(StatusSchema.parse('FAIL')).toBe('FAIL');
    expect(SeveritySchema.parse('CRITICAL')).toBe('CRITICAL');
    expect(() => StatusSchema.parse('INVALID')).toThrow();
  });

  it('should validate ProjectProfile Schema', () => {
    const validProfile = {
      name: 'sample-app',
      rootPath: '/app',
      languages: ['typescript'],
      frameworks: ['express'],
      runtime: 'node',
      databases: ['postgresql'],
      architecture: 'monolith',
      projectType: 'api-server',
      hosting: ['docker'],
      packageManager: 'pnpm',
      hasDockerfile: true,
      hasCIConfig: false,
      entrypoints: ['src/index.ts'],
      testFrameworks: ['vitest'],
      envFiles: ['.env'],
      dependencies: { express: '^4.21.2' },
      devDependencies: { typescript: '^5.7.3' }
    };

    const parsed = ProjectProfileSchema.parse(validProfile);
    expect(parsed.name).toBe('sample-app');
  });

  it('should validate ExecutionContext with defaults', () => {
    const ctx = ExecutionContextSchema.parse({ projectRoot: '/test' });
    expect(ctx.timeoutMs).toBe(30000);
    expect(ctx.logLevel).toBe('normal');
    expect(ctx.failFast).toBe(false);
  });

  it('should validate Evidence and ExecutionResult schemas', () => {
    const evidence = EvidenceSchema.parse({
      id: 'ev-1',
      command: 'npm test',
      stdout: 'All tests passed',
      stderr: '',
      exitCode: 0,
      durationMs: 120,
      capturedAt: new Date().toISOString()
    });

    const result = ExecutionResultSchema.parse({
      id: 'res-1',
      targetId: 'target-1',
      name: 'Sample Test',
      type: 'test',
      status: 'PASS',
      severity: 'INFO',
      durationMs: 120,
      evidence,
      explanation: 'Success'
    });

    expect(result.status).toBe('PASS');
  });
});
