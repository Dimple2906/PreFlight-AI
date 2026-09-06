import { ProjectProfile, ExecutionResult } from '@preflight/core';
import { AIProvider } from './providers/AIProvider.js';
import { GeminiProvider } from './providers/gemini/GeminiProvider.js';
import { MockAIProvider } from './providers/mock/MockAIProvider.js';
import { PayloadSanitizer } from './sanitization/payload-sanitizer.js';
import {
  ProjectContext,
  ProjectAnalysis,
  TestPlan,
  EvidenceAnalysis,
  TestRecommendation,
  SanitizedEvidenceItem
} from './schemas/ai-response.js';

export interface AIEngineOptions {
  provider?: 'gemini' | 'mock';
  apiKey?: string;
  modelName?: string;
}

export interface AIStatusInfo {
  provider: 'gemini' | 'mock';
  available: boolean;
  model: string;
}

export class AIEngine {
  private provider: AIProvider;
  private sanitizer: PayloadSanitizer;
  private isGemini: boolean;
  private modelName: string;

  constructor(options: AIEngineOptions = {}) {
    this.sanitizer = new PayloadSanitizer();
    this.modelName = options.modelName || 'gemini-3.6-flash';

    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    const hasKey = Boolean(apiKey && apiKey.trim().length > 0);

    if (options.provider === 'gemini' || (!options.provider && hasKey)) {
      this.provider = new GeminiProvider(apiKey, this.modelName);
      this.isGemini = true;
    } else {
      this.provider = new MockAIProvider();
      this.isGemini = false;
    }
  }

  public getStatus(): AIStatusInfo {
    if (this.isGemini && this.provider instanceof GeminiProvider) {
      return {
        provider: 'gemini',
        available: this.provider.isAvailable(),
        model: this.modelName
      };
    }
    return {
      provider: 'mock',
      available: true,
      model: 'deterministic-mock'
    };
  }

  public buildProjectContext(profile: ProjectProfile): ProjectContext {
    const rawSanitized = this.sanitizer.sanitizeProfile(profile);
    const riskSignals: string[] = [];

    if (profile.domainSignals?.includes('auth') || profile.frameworks?.includes('express') || profile.frameworks?.includes('nest')) {
      riskSignals.push('authentication');
    }
    if (profile.databases?.length > 0) {
      riskSignals.push('database-state-changes');
    }
    if (profile.domainSignals?.includes('external-api')) {
      riskSignals.push('external-api-integration');
    }
    if (profile.projectType === 'api-server') {
      riskSignals.push('state-changing-endpoints');
    }

    return {
      name: String(rawSanitized.name || 'unnamed-project'),
      projectType: String(rawSanitized.projectType || 'unknown'),
      languages: (rawSanitized.languages as string[]) || [],
      frameworks: (rawSanitized.frameworks as string[]) || [],
      runtime: String(rawSanitized.runtime || 'node'),
      databases: (rawSanitized.databases as string[]) || [],
      packageManager: String(rawSanitized.packageManager || 'npm'),
      architecture: String(rawSanitized.architecture || 'unknown'),
      hosting: (rawSanitized.hosting as string[]) || [],
      hasDockerfile: Boolean(rawSanitized.hasDockerfile),
      hasCIConfig: Boolean(rawSanitized.hasCIConfig),
      domainSignals: (rawSanitized.domainSignals as string[]) || [],
      dependenciesCount: Number(rawSanitized.dependenciesCount || 0),
      devDependenciesCount: Number(rawSanitized.devDependenciesCount || 0),
      riskSignals
    };
  }

  public buildSanitizedEvidence(results: ExecutionResult[]): SanitizedEvidenceItem[] {
    const sanitizedRaw = this.sanitizer.sanitizeResults(results);
    return sanitizedRaw.map((r: any) => ({
      testId: String(r.targetId || r.id),
      name: String(r.name),
      status: r.status,
      durationMs: Number(r.durationMs || 0),
      severity: String(r.severity),
      explanation: String(r.explanation || ''),
      evidence: {
        command: r.evidence?.command,
        exitCode: r.evidence?.exitCode,
        stdout: r.evidence?.stdoutSnippet,
        stderr: r.evidence?.stderrSnippet
      }
    }));
  }

  public async analyzeProjectRisk(profile: ProjectProfile): Promise<ProjectAnalysis> {
    const context = this.buildProjectContext(profile);
    return this.provider.analyzeProject(context);
  }

  public async generateTestPlan(
    profile: ProjectProfile,
    availableCapabilities: Array<{ id: string; name: string; category: string; description: string }>
  ): Promise<TestPlan> {
    const projectContext = this.buildProjectContext(profile);
    return this.provider.generateTestPlan({
      projectContext,
      availableCapabilities
    });
  }

  public async analyzeEvidence(
    profile: ProjectProfile,
    results: ExecutionResult[]
  ): Promise<EvidenceAnalysis> {
    const projectContext = this.buildProjectContext(profile);
    const executedResults = this.buildSanitizedEvidence(results);
    return this.provider.analyzeEvidence({
      projectContext,
      executedResults
    });
  }

  public async recommendAdditionalTests(
    profile: ProjectProfile,
    results: ExecutionResult[],
    availableCapabilities: Array<{ id: string; name: string; category: string }>
  ): Promise<TestRecommendation[]> {
    const projectContext = this.buildProjectContext(profile);
    const executedResults = this.buildSanitizedEvidence(results);
    return this.provider.recommendAdditionalTests({
      projectContext,
      executedResults,
      uncoveredSignals: projectContext.riskSignals,
      availableCapabilities
    });
  }
}
