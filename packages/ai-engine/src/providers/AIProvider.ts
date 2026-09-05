import { ProjectProfile, ExecutionResult } from '@preflight/core';
import {
  ProjectAnalysisResult,
  QAGapAnalysisResult,
  DeploymentGapAnalysisResult,
  FailureAnalysisResult
} from '../schemas/ai-schemas.js';

export interface AIProvider {
  name: string;
  analyzeProject(profile: ProjectProfile): Promise<ProjectAnalysisResult>;
  analyzeQAGaps(profile: ProjectProfile, results: ExecutionResult[]): Promise<QAGapAnalysisResult>;
  analyzeDeploymentGaps(profile: ProjectProfile, results: ExecutionResult[]): Promise<DeploymentGapAnalysisResult>;
  analyzeFailure(failure: ExecutionResult): Promise<FailureAnalysisResult>;
}
