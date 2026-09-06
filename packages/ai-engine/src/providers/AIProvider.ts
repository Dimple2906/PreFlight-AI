import {
  ProjectContext,
  ProjectAnalysis,
  TestPlanningContext,
  TestPlan,
  EvidenceContext,
  EvidenceAnalysis,
  GapAnalysisContext,
  TestRecommendation
} from '../schemas/ai-response.js';

export interface AIProvider {
  name: string;
  analyzeProject(context: ProjectContext): Promise<ProjectAnalysis>;
  generateTestPlan(context: TestPlanningContext): Promise<TestPlan>;
  analyzeEvidence(context: EvidenceContext): Promise<EvidenceAnalysis>;
  recommendAdditionalTests(context: GapAnalysisContext): Promise<TestRecommendation[]>;
}
