import { AIProvider } from './AIProvider.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';
import {
  ProjectAnalysisResult,
  QAGapAnalysisResult,
  DeploymentGapAnalysisResult,
  FailureAnalysisResult,
  QAGapAnalysisSchema,
  DeploymentGapAnalysisSchema,
  ProjectAnalysisSchema,
  FailureAnalysisSchema
} from '../schemas/ai-schemas.js';

export class MockProvider implements AIProvider {
  public name = 'mock';

  public async analyzeProject(profile: ProjectProfile): Promise<ProjectAnalysisResult> {
    return ProjectAnalysisSchema.parse({
      summary: `Offline Analysis for ${profile.name} (${profile.projectType}).`,
      detectedArchitectureRisk: profile.hasDockerfile ? 'Container environment configured.' : 'No Docker environment detected.',
      recommendedTestingStrategy: ['Execute unit test suite', 'Verify API endpoint contracts']
    });
  }

  public async analyzeQAGaps(profile: ProjectProfile, results: ExecutionResult[]): Promise<QAGapAnalysisResult> {
    const failed = results.filter(r => r.status === 'FAIL' || r.status === 'ERROR');

    const rootCauseAnalyses = failed.map(r => ({
      resultId: r.id,
      possibleRootCause: `Execution failure in ${r.name}`,
      risk: 'Production assertion failure',
      impact: 'High risk of runtime error',
      confidence: 'HIGH' as const,
      suggestedFix: `Inspect logs for ${r.name}`
    }));

    return QAGapAnalysisSchema.parse({
      summary: `Offline Mock QA Analysis: ${results.length} tests executed, ${failed.length} failed.`,
      rootCauseAnalyses,
      coverageGaps: profile.domainSignals.includes('payments') ? [
        {
          id: 'gap-payment-webhook',
          area: 'Payments Integrity',
          description: 'Payment domain signal detected without webhook replay verification.',
          severity: 'HIGH' as const,
          recommendedAction: 'Verify payment idempotency and webhook signature verification.',
          suggestedCapabilityId: 'CONC-001'
        }
      ] : [],
      additionalCheckRecommendations: []
    });
  }

  public async analyzeDeploymentGaps(profile: ProjectProfile, results: ExecutionResult[]): Promise<DeploymentGapAnalysisResult> {
    return DeploymentGapAnalysisSchema.parse({
      summary: 'Offline Deployment Readiness Assessment',
      riskAssessment: 'Basic deployment checks evaluated offline.',
      recommendedChecks: []
    });
  }

  public async analyzeFailure(failure: ExecutionResult): Promise<FailureAnalysisResult> {
    return FailureAnalysisSchema.parse({
      resultId: failure.id,
      possibleRootCause: failure.explanation || 'Non-zero exit code encountered',
      risk: 'Runtime failure',
      impact: 'Application unready for deployment',
      confidence: 'HIGH',
      suggestedFix: 'Review stdout/stderr evidence logs'
    });
  }
}
