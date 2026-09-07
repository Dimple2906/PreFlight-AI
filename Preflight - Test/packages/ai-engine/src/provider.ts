import { AIAnalysis, ExecutionResult, ProjectProfile } from '@preflight/core';

export interface AIProvider {
  name: string;
  analyze(
    profile: ProjectProfile,
    results: ExecutionResult[]
  ): Promise<AIAnalysis>;
}
