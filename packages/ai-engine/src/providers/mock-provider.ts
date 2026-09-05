import { AIProvider } from '../provider.js';
import { AIAnalysis, ExecutionResult, ProjectProfile, AIAnalysisSchema } from '@preflight/core';
import { SecretSanitizer } from '@preflight/security';

export class MockAIProvider implements AIProvider {
  public name = 'mock';
  private sanitizer = new SecretSanitizer();

  public async analyze(
    profile: ProjectProfile,
    results: ExecutionResult[]
  ): Promise<AIAnalysis> {
    const failedResults = results.filter(r => r.status === 'FAIL' || r.status === 'ERROR');

    const rootCauseAnalyses = failedResults.map(res => {
      const sanitizedStderr = this.sanitizer.sanitize(res.evidence.stderr).sanitizedText;
      return {
        resultId: res.id,
        possibleRootCause: `Execution failed with output snippet: ${sanitizedStderr.slice(0, 150) || 'Non-zero exit code encountered.'}`,
        confidence: 'HIGH' as const,
        suggestedFix: `Inspect stderr logs for '${res.name}' and fix underlying assertion failure.`
      };
    });

    const coverageGaps = [];
    if (!profile.testFrameworks.length) {
      coverageGaps.push({
        id: 'gap-no-test-framework',
        area: 'Testing Infrastructure',
        description: 'No automated test runner (e.g. Vitest, Jest) detected in dependencies.',
        severity: 'MEDIUM' as const,
        recommendedAction: 'Install Vitest or Jest to support unit and integration testing.',
        suggestedCheckCommand: 'npm install -D vitest'
      });
    }

    if (!profile.hasDockerfile && profile.hosting.includes('docker')) {
      coverageGaps.push({
        id: 'gap-missing-dockerfile',
        area: 'Deployment Packaging',
        description: 'Docker hosting configured but no Dockerfile present in root.',
        severity: 'HIGH' as const,
        recommendedAction: 'Add a multi-stage Dockerfile to containerize the application.'
      });
    }

    return AIAnalysisSchema.parse({
      summary: `PreFlight Offline Analysis: Analyzed ${results.length} execution results across ${profile.name} (${profile.projectType}). Identified ${failedResults.length} failures and ${coverageGaps.length} coverage gaps.`,
      rootCauseAnalyses,
      coverageGaps,
      additionalCheckRecommendations: [
        {
          id: 'rec-sec-audit',
          name: 'Dependency Vulnerability Audit',
          reason: 'Scan node_modules for known CVE security vulnerabilities.',
          command: 'npm audit --json'
        }
      ],
      sanitizedTokensCount: 0,
      analyzedAt: new Date().toISOString()
    });
  }
}
