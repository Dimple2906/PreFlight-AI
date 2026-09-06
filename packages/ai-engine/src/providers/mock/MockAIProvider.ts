import { AIProvider } from '../AIProvider.js';
import {
  ProjectContext,
  ProjectAnalysis,
  TestPlanningContext,
  TestPlan,
  EvidenceContext,
  EvidenceAnalysis,
  GapAnalysisContext,
  TestRecommendation,
  AIRecommendedTest
} from '../../schemas/ai-response.js';

export class MockAIProvider implements AIProvider {
  public readonly name = 'mock';

  public async analyzeProject(context: ProjectContext): Promise<ProjectAnalysis> {
    const riskSignals: string[] = [];
    const recommendedTestingStrategy: string[] = [];

    if (context.domainSignals.includes('auth') || context.frameworks.includes('express') || context.frameworks.includes('nest')) {
      riskSignals.push('Authentication & authorization boundaries present');
      recommendedTestingStrategy.push('Adversarial authentication token and credentials probe');
    }
    if (context.databases.length > 0 || context.domainSignals.includes('databases')) {
      riskSignals.push(`State-changing database writes on ${context.databases.join(', ') || 'datastore'}`);
      recommendedTestingStrategy.push('SQL injection and state transition integrity checks');
    }
    if (context.domainSignals.includes('external-api')) {
      riskSignals.push('External API dependencies with potential network failure modes');
      recommendedTestingStrategy.push('Resilience and timeout handling verification');
    }
    if (context.projectType === 'api-server' || context.projectType === 'fullstack-web') {
      riskSignals.push('Exposed HTTP endpoints susceptible to high-concurrency burst attacks');
      recommendedTestingStrategy.push('Concurrent request burst and rate-limiting validation');
    }

    if (riskSignals.length === 0) {
      riskSignals.push('Standard application runtime surface');
      recommendedTestingStrategy.push('Unit test suite and type safety verification');
    }

    return {
      summary: `Discovered ${context.projectType} using ${context.languages.join(', ') || 'Node'} and ${context.frameworks.join(', ') || 'standard runtime'}. Identified ${riskSignals.length} risk vectors.`,
      detectedArchitectureRisk: `Identified potential failure surfaces across ${context.frameworks.join(', ') || 'stack'} with ${context.databases.join(', ') || 'no dedicated DB'}.`,
      riskSignals,
      recommendedTestingStrategy
    };
  }

  public async generateTestPlan(context: TestPlanningContext): Promise<TestPlan> {
    const recommendedTests: AIRecommendedTest[] = [];
    const { projectContext, availableCapabilities } = context;

    for (const cap of availableCapabilities) {
      if (cap.category === 'authentication' || cap.id.includes('auth')) {
        recommendedTests.push({
          id: cap.id,
          category: 'authentication',
          title: cap.name,
          objective: 'Verify rejection of unauthenticated or tampered request credentials',
          rationale: 'Project exposes authenticated routes that must fail closed on missing/invalid tokens',
          risk: 'high',
          target: '/api',
          prerequisites: []
        });
      } else if (cap.category === 'input' || cap.id.includes('input')) {
        recommendedTests.push({
          id: cap.id,
          category: 'input',
          title: cap.name,
          objective: 'Verify robust handling of empty, negative, or malformed input payloads',
          rationale: 'Publicly reachable endpoints must validate schema boundaries',
          risk: 'medium',
          target: '/api',
          prerequisites: []
        });
      } else if (cap.category === 'concurrency' || cap.id.includes('conc')) {
        recommendedTests.push({
          id: cap.id,
          category: 'concurrency',
          title: cap.name,
          objective: 'Verify idempotent execution under concurrent request bursts',
          rationale: 'Stateful endpoints can experience race conditions during parallel requests',
          risk: 'high',
          target: '/api',
          prerequisites: []
        });
      } else {
        recommendedTests.push({
          id: cap.id,
          category: 'security',
          title: cap.name,
          objective: 'Verify system invariants and boundaries',
          rationale: 'Production hardening check',
          risk: 'medium',
          prerequisites: []
        });
      }
    }

    return {
      summary: `AI generated test plan proposing ${recommendedTests.length} adversarial test scenarios based on project architecture.`,
      recommendedTests
    };
  }

  public async analyzeEvidence(context: EvidenceContext): Promise<EvidenceAnalysis> {
    const failures = context.executedResults.filter((r) => r.status === 'FAIL' || r.status === 'ERROR' || r.status === 'WARN');
    const rootCauseAnalyses = failures.map((f) => ({
      resultId: f.testId,
      possibleRootCause: `Adversarial probe revealed non-compliant behavior in ${f.name}: ${f.explanation}`,
      risk: `High susceptibility to ${f.severity.toLowerCase()} severity exploitation`,
      impact: 'Potential data leak, denial of service, or unauthorized state mutation in production',
      confidence: 'HIGH' as const,
      suggestedFix: `Apply boundary validation, proper error sanitization, or authentication middleware at the route level.`
    }));

    const coverageGaps = [];
    const hasConcurrency = context.executedResults.some((r) => r.testId.includes('conc') && r.status === 'PASS');
    if (!hasConcurrency && (context.projectContext.projectType === 'api-server' || context.projectContext.projectType === 'fullstack-web')) {
      coverageGaps.push({
        id: 'gap-concurrency-state',
        area: 'concurrency',
        description: 'Concurrency and race condition behavior under parallel bursts remains untested.',
        severity: 'MEDIUM' as const,
        recommendedAction: 'Execute concurrent request burst probes to verify transaction isolation.',
        suggestedCapabilityId: 'qa-conc-requests'
      });
    }

    const hasRateLimit = context.executedResults.some((r) => r.testId.includes('rate-limit') && r.status === 'PASS');
    if (!hasRateLimit && context.projectContext.projectType === 'api-server') {
      coverageGaps.push({
        id: 'gap-rate-limiting',
        area: 'rate-limiting',
        description: 'No rate-limiting protection detected or verified on public API endpoints.',
        severity: 'LOW' as const,
        recommendedAction: 'Verify rate-limiting headers (429 Too Many Requests) under rapid polling.',
        suggestedCapabilityId: 'qa-rate-limit'
      });
    }

    return {
      summary: failures.length > 0
        ? `Identified ${failures.length} deterministic test failures requiring remediation.`
        : 'All executed tests passed deterministically. Found coverage gaps to consider.',
      rootCauseAnalyses,
      coverageGaps,
      remediationRecommendations: failures.map((f) => ({
        area: f.name,
        action: `Review and harden endpoint implementation corresponding to ${f.name}.`,
        priority: 'high' as const
      }))
    };
  }

  public async recommendAdditionalTests(context: GapAnalysisContext): Promise<TestRecommendation[]> {
    const recommendations: TestRecommendation[] = [];
    const executedIds = new Set(context.executedResults.map((r) => r.testId));

    for (const cap of context.availableCapabilities) {
      if (!executedIds.has(cap.id)) {
        if (cap.id.includes('rate-limit') || cap.id.includes('conc')) {
          recommendations.push({
            id: `rec-${cap.id}`,
            category: cap.category,
            title: cap.name,
            rationale: `High-risk gap: ${cap.name} was not executed in the initial test pass.`,
            priority: 'high',
            capabilityId: cap.id
          });
        }
      }
    }

    return recommendations;
  }
}
