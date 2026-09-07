import { describe, it, expect } from 'vitest';
import { ReportEngine } from '../reporter.js';
import { FinalReport } from '@preflight/core';

describe('ReportEngine', () => {
  const mockReport: FinalReport = {
    reportId: 'rep-001',
    mode: 'test',
    overallStatus: 'FAIL',
    generatedAt: '2026-09-05T20:30:00.000Z',
    projectProfile: {
      name: 'ShopX',
      rootPath: '/projects/shopx',
      languages: ['typescript', 'javascript'],
      frameworks: ['nextjs', 'react'],
      runtime: 'node',
      databases: ['postgresql'],
      architecture: 'monolith',
      projectType: 'web-app',
      hosting: ['vercel'],
      packageManager: 'pnpm',
      hasDockerfile: true,
      hasCIConfig: true,
      entrypoints: ['src/index.ts'],
      testFrameworks: ['vitest'],
      envFiles: ['.env.example'],
      dependencies: { next: '^14.0.0' },
      devDependencies: { vitest: '^1.0.0' },
      domainSignals: ['auth', 'e-commerce'],
      evidenceList: []
    },
    results: [
      {
        id: 'res-1',
        targetId: 'AUTH-001',
        name: 'Missing Authorization Header Test',
        type: 'test',
        status: 'FAIL',
        severity: 'HIGH',
        durationMs: 45,
        evidence: {
          id: 'ev-1',
          command: 'curl http://localhost:3000/api/admin/secrets -H "Authorization: Bearer secret-token-12345"',
          stdout: 'HTTP/1.1 200 OK\n{"key": "sk-proj-12345678901234567890123456789012"}',
          stderr: '',
          exitCode: 0,
          durationMs: 45,
          artifacts: [],
          capturedAt: '2026-09-05T20:30:00.000Z'
        },
        explanation: 'Verify administrative endpoint rejects unauthorized requests',
        remediation: 'Add requireAuth middleware to /api/admin routes',
        findings: [
          {
            id: 'find-1',
            title: 'Unauthenticated Admin Endpoint',
            description: 'The endpoint /api/admin/secrets returned 200 OK without valid credentials',
            severity: 'HIGH',
            status: 'FAIL',
            location: '/api/admin/secrets',
            remediation: 'Enforce auth guard on all admin endpoints'
          }
        ]
      },
      {
        id: 'res-2',
        targetId: 'INPUT-001',
        name: 'SQL Injection Boundary Test',
        type: 'test',
        status: 'PASS',
        severity: 'CRITICAL',
        durationMs: 120,
        evidence: {
          id: 'ev-2',
          command: "curl http://localhost:3000/api/search?q=' OR 1=1 --",
          stdout: 'HTTP/1.1 400 Bad Request',
          stderr: '',
          exitCode: 0,
          durationMs: 120,
          artifacts: [],
          capturedAt: '2026-09-05T20:30:00.000Z'
        },
        explanation: 'Verify search query parameter sanitization against SQL injection',
        remediation: 'Use parameterized ORM queries',
        findings: []
      }
    ],
    stats: {
      total: 2,
      passed: 1,
      failed: 1,
      warned: 0,
      skipped: 0,
      errored: 0,
      durationMs: 165
    },
    aiAnalysis: {
      summary: 'Adversarial QA detected unauthenticated access on administrative endpoints.',
      rootCauseAnalyses: [
        {
          resultId: 'AUTH-001',
          possibleRootCause: 'Missing auth middleware binding on /api/admin routes in router setup.',
          confidence: 'HIGH',
          suggestedFix: 'Wrap admin router with authenticateToken middleware'
        }
      ],
      coverageGaps: [
        {
          id: 'gap-1',
          area: 'Rate Limiting',
          description: 'No rate limiting headers detected on authentication endpoint /api/login.',
          severity: 'MEDIUM',
          recommendedAction: 'Implement express-rate-limit middleware on auth routes.'
        }
      ],
      additionalCheckRecommendations: [
        {
          id: 'rec-1',
          name: 'JWT Expiration Check',
          reason: 'Verify JWT tokens enforce strict exp claim validation.',
          command: 'preflight test --category auth'
        }
      ],
      sanitizedTokensCount: 1,
      analyzedAt: '2026-09-05T20:30:00.000Z'
    }
  };

  it('renders stable v1.0 JSON format with secret redaction', () => {
    const reporter = new ReportEngine();
    const jsonStr = reporter.renderJson(mockReport);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.version).toBe('1.0');
    expect(parsed.project.name).toBe('ShopX');
    expect(parsed.summary.failed).toBe(1);
    expect(parsed.verdict.code).toBe('🔴 PREFLIGHT FAILED');
    expect(parsed.verdict.passed).toBe(false);

    // Verify secret in stdout was sanitized
    const authTest = parsed.tests.find((t: any) => t.id === 'AUTH-001');
    expect(authTest).toBeDefined();
    expect(authTest.evidence.stdout).not.toContain('sk-proj-12345678901234567890123456789012');
    expect(authTest.evidence.stdout).toContain('[REDACTED]');
  });

  it('renders Terminal output with correct verdict badges and failure details', () => {
    const reporter = new ReportEngine();
    const terminalStr = reporter.renderTerminal(mockReport);

    expect(terminalStr).toContain('PREFLIGHT AI - TEST READINESS REPORT');
    expect(terminalStr).toContain('🔴 PREFLIGHT FAILED');
    expect(terminalStr).toContain('FAILED TEST / CHECK DETAILS');
    expect(terminalStr).toContain('Missing Authorization Header Test');
    expect(terminalStr).toContain('Suggested Fix:');
    expect(terminalStr).toContain('Summary: 1 Passed | 1 Failed');
  });

  it('renders deploy mode verdict badges correctly', () => {
    const reporter = new ReportEngine();
    expect(reporter.getVerdictCode('deploy', 'PASS')).toBe('🟢 GO');
    expect(reporter.getVerdictCode('deploy', 'WARN')).toBe('🟡 GO WITH WARNINGS');
    expect(reporter.getVerdictCode('deploy', 'FAIL')).toBe('🔴 NO-GO');
  });

  it('renders Markdown report with complete sections', () => {
    const reporter = new ReportEngine();
    const md = reporter.renderMarkdown(mockReport);

    expect(md).toContain('# PreFlight AI Report');
    expect(md).toContain('🔴 PREFLIGHT FAILED');
    expect(md).toContain('## Project Summary');
    expect(md).toContain('## Classification');
    expect(md).toContain('## Tests Executed');
    expect(md).toContain('## Failed Test Details');
    expect(md).toContain('### Missing Authorization Header Test');
    expect(md).toContain('## AI Analysis & Coverage Gaps');
    expect(md).toContain('## Final Verdict');
  });
});
