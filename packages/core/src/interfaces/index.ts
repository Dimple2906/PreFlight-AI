import {
  ProjectProfile,
  TestDefinition,
  CheckDefinition,
  ExecutionResult,
  FinalReport,
  AIAnalysis,
  ExecutionContext
} from '../domain/index.js';

export interface TestRunner {
  execute(testDef: TestDefinition, ctx: ExecutionContext): Promise<ExecutionResult>;
}

export interface CheckRunner {
  execute(checkDef: CheckDefinition, ctx: ExecutionContext): Promise<ExecutionResult>;
}

export interface TestRegistry {
  register(testDef: TestDefinition): void;
  getTestsForProject(profile: ProjectProfile): TestDefinition[];
}

export interface CheckRegistry {
  register(checkDef: CheckDefinition): void;
  getChecksForProject(profile: ProjectProfile): CheckDefinition[];
}

export interface ProjectDiscovery {
  inspect(targetPath: string): Promise<Record<string, unknown>>;
}

export interface ProjectClassifier {
  classify(discoveredData: Record<string, unknown>): ProjectProfile;
}

export interface AIProvider {
  name: string;
  analyze(profile: ProjectProfile, results: ExecutionResult[]): Promise<AIAnalysis>;
}

export interface ReportRenderer {
  renderTerminal(report: FinalReport): string;
  renderJson(report: FinalReport): string;
}

export interface SecretSanitizer {
  registerSecret(secretValue: string): void;
  registerEnvSecrets(envRecord: Record<string, string>): void;
  sanitize(text: string): { sanitizedText: string; redactedCount: number };
}
