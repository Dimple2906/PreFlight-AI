import { describe, it, expect } from 'vitest';
import { GeminiProvider } from '../providers/gemini/GeminiProvider.js';
import { MockAIProvider } from '../providers/mock/MockAIProvider.js';
import { PayloadSanitizer } from '../sanitization/payload-sanitizer.js';
import { AIEngine } from '../AIEngine.js';
import { createAIProvider } from '../factory.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

describe('AI Reasoning Layer & Provider Architecture', () => {
  const sampleProfile: ProjectProfile = {
    name: 'shop-x',
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
    hasCIConfig: true,
    entrypoints: ['src/index.ts'],
    testFrameworks: ['vitest'],
    envFiles: ['.env'],
    dependencies: { express: '^4.19.0', pg: '^8.11.0' },
    devDependencies: {},
    domainSignals: ['payments', 'auth'],
    evidenceList: []
  };

  const sampleResults: ExecutionResult[] = [
    {
      id: 'res-1',
      targetId: 'qa-auth-missing',
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

  it('should fall back to MockAIProvider cleanly when GEMINI_API_KEY is missing', async () => {
    const provider = new GeminiProvider(''); // empty API key
    expect(provider.isAvailable()).toBe(false);

    const context = new AIEngine().buildProjectContext(sampleProfile);
    const analysis = await provider.analyzeProject(context);

    expect(analysis.summary).toContain('api-server');
    expect(analysis.riskSignals.length).toBeGreaterThan(0);
  });

  it('should generate structured test plan via MockAIProvider deterministically', async () => {
    const mock = new MockAIProvider();
    const context = new AIEngine().buildProjectContext(sampleProfile);
    const plan = await mock.generateTestPlan({
      projectContext: context,
      availableCapabilities: [
        { id: 'qa-auth-missing', name: 'Missing Credentials Probe', category: 'authentication', description: 'desc' },
        { id: 'qa-conc-requests', name: 'Concurrent Request Burst', category: 'concurrency', description: 'desc' }
      ]
    });

    expect(plan.recommendedTests.length).toBeGreaterThan(0);
    expect(plan.recommendedTests[0].id).toBe('qa-auth-missing');
    expect(plan.recommendedTests[0].risk).toBe('high');
  });

  it('should instantiate provider via createAIProvider factory', () => {
    const p1 = createAIProvider('mock');
    expect(p1.name).toBe('mock');

    const p2 = createAIProvider('gemini', 'test-key');
    expect(p2.name).toBe('gemini');
  });

  it('should orchestrate via AIEngine coordinator', async () => {
    const engine = new AIEngine({ provider: 'mock' });
    const status = engine.getStatus();
    expect(status.provider).toBe('mock');
    expect(status.available).toBe(true);

    const risk = await engine.analyzeProjectRisk(sampleProfile);
    expect(risk.riskSignals.length).toBeGreaterThan(0);

    const evidenceAnalysis = await engine.analyzeEvidence(sampleProfile, sampleResults);
    expect(evidenceAnalysis.rootCauseAnalyses.length).toBe(1);
    expect(evidenceAnalysis.rootCauseAnalyses[0].confidence).toBe('HIGH');
  });
});
