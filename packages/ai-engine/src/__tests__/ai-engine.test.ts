import { describe, it, expect } from 'vitest';
import { GeminiProvider } from '../providers/GeminiProvider.js';
import { MockProvider } from '../providers/MockProvider.js';
import { PayloadSanitizer } from '../sanitization/payload-sanitizer.js';
import { createAIProvider } from '../factory.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

describe('AI Reasoning Layer & Provider Testing', () => {
  const sampleProfile: ProjectProfile = {
    name: 'shop-x',
    rootPath: '/app',
    languages: ['typescript'],
    frameworks: ['nextjs'],
    runtime: 'node',
    databases: ['postgresql'],
    architecture: 'monolith',
    projectType: 'fullstack',
    hosting: ['vercel'],
    packageManager: 'pnpm',
    hasDockerfile: false,
    hasCIConfig: true,
    entrypoints: [],
    testFrameworks: ['vitest'],
    envFiles: ['.env'],
    dependencies: { next: '^14.0.0', stripe: '^15.0.0' },
    devDependencies: {},
    domainSignals: ['payments', 'auth'],
    evidenceList: []
  };

  const sampleResults: ExecutionResult[] = [
    {
      id: 'res-1',
      targetId: 'AUTH-001',
      name: 'Missing Credentials Probe',
      type: 'test',
      status: 'FAIL',
      severity: 'HIGH',
      durationMs: 120,
      evidence: {
        id: 'ev-1',
        stdout: 'API key sk-1234567890abcdef1234567890abcdef exposed on /api/user',
        stderr: '',
        exitCode: 1,
        durationMs: 120,
        artifacts: [],
        capturedAt: new Date().toISOString()
      },
      explanation: 'Security flaw: Missing auth check.',
      findings: []
    }
  ];

  it('should sanitize secrets from profile and execution evidence before AI transmission', () => {
    const sanitizer = new PayloadSanitizer();
    const safeResults = sanitizer.sanitizeResults(sampleResults);

    expect(safeResults[0].evidence).toBeDefined();
    const stdoutSnippet = (safeResults[0].evidence as any).stdoutSnippet;
    expect(stdoutSnippet).not.toContain('sk-1234567890abcdef1234567890abcdef');
    expect(stdoutSnippet).toContain('[REDACTED');
  });

  it('should fall back to MockProvider cleanly when GEMINI_API_KEY is missing', async () => {
    const provider = new GeminiProvider(''); // empty API key
    const analysis = await provider.analyzeQAGaps(sampleProfile, sampleResults);

    expect(analysis.summary).toContain('Offline Mock QA Analysis');
    expect(analysis.rootCauseAnalyses.length).toBeGreaterThan(0);
  });

  it('should execute MockProvider offline analysis deterministically', async () => {
    const mock = new MockProvider();
    const projectAnalysis = await mock.analyzeProject(sampleProfile);
    expect(projectAnalysis.summary).toContain('Offline Analysis');

    const qaAnalysis = await mock.analyzeQAGaps(sampleProfile, sampleResults);
    expect(qaAnalysis.coverageGaps.length).toBeGreaterThan(0);
    expect(qaAnalysis.coverageGaps[0].suggestedCapabilityId).toBe('CONC-001');
  });

  it('should instantiate provider via createAIProvider factory', () => {
    const p1 = createAIProvider('mock');
    expect(p1.name).toBe('mock');

    const p2 = createAIProvider('gemini', 'test-key');
    expect(p2.name).toBe('gemini');
  });
});
