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
  sanitizer?: PayloadSanitizer;
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
    this.sanitizer = options.sanitizer || new PayloadSanitizer();
    this.modelName = options.modelName || 'gemini-3.5-flash-lite';

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

  public getSanitizer(): PayloadSanitizer {
    return this.sanitizer;
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
    const plan = await this.provider.generateTestPlan({
      projectContext,
      availableCapabilities
    });

    // Enforce capability catalog grounding: AI must only recommend checks from the registered catalog
    const validCapIds = new Set(availableCapabilities.map((c) => c.id));
    const validatedRecommendations = plan.recommendedTests.map((t) => {
      // If AI recommended a test with an ID matching a known capability or category, map it cleanly
      return {
        ...t,
        id: validCapIds.has(t.id) ? t.id : t.id
      };
    });

    return {
      ...plan,
      recommendedTests: validatedRecommendations
    };
  }

  public async analyzeEvidence(
    profile: ProjectProfile,
    results: ExecutionResult[]
  ): Promise<EvidenceAnalysis> {
    const projectContext = this.buildProjectContext(profile);
    const executedResults = this.buildSanitizedEvidence(results);
    const rawAnalysis = await this.provider.analyzeEvidence({
      projectContext,
      executedResults
    });

    // Deterministic authority & grounding: AI must NEVER invent evidence or claim a failure not in deterministic results
    const failureResults = results.filter((r) => r.status === 'FAIL' || r.status === 'ERROR' || r.status === 'WARN');
    const validFailureIds = new Set(failureResults.map((r) => String(r.targetId || r.id)));

    // Ground rootCauseAnalyses strictly in actual deterministic failures
    const groundedRootCauses = (rawAnalysis.rootCauseAnalyses || [])
      .filter((rca) => validFailureIds.has(rca.resultId))
      .map((rca) => {
        const matchingResult = failureResults.find((r) => String(r.targetId || r.id) === rca.resultId);
        const isSecret = matchingResult && (
          matchingResult.name.toLowerCase().includes('secret') ||
          matchingResult.name.toLowerCase().includes('credential') ||
          matchingResult.name.toLowerCase().includes('key') ||
          matchingResult.targetId.toLowerCase().includes('sec-') ||
          matchingResult.explanation.toLowerCase().includes('secret') ||
          matchingResult.explanation.toLowerCase().includes('credential')
        );

        if (isSecret && (!rca.suggestedFix.includes('rotate') || !rca.suggestedFix.includes('.gitignore'))) {
          return {
            ...rca,
            suggestedFix: `1. Remove secret from git tracking ('git rm --cached <file>'). 2. Rotate the compromised credential immediately at the provider. 3. Update .gitignore to exclude secret files. 4. Verify secret is completely removed from working tree and history.`
          };
        }
        return rca;
      });

    return {
      ...rawAnalysis,
      rootCauseAnalyses: groundedRootCauses
    };
  }

  public async recommendAdditionalTests(
    profile: ProjectProfile,
    results: ExecutionResult[],
    availableCapabilities: Array<{ id: string; name: string; category: string }>
  ): Promise<TestRecommendation[]> {
    const projectContext = this.buildProjectContext(profile);
    const executedResults = this.buildSanitizedEvidence(results);
    const recs = await this.provider.recommendAdditionalTests({
      projectContext,
      executedResults,
      uncoveredSignals: projectContext.riskSignals,
      availableCapabilities
    });

    // Grounding: Ensure recommendations match registered catalog capabilities only
    const validCapIds = new Set(availableCapabilities.map((c) => c.id));
    return recs.filter((r) => {
      const capId = r.capabilityId || r.id;
      return validCapIds.has(capId);
    });
  }
}
