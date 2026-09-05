import { AIProvider } from './AIProvider.js';
import { MockProvider } from './MockProvider.js';
import { PayloadSanitizer } from '../sanitization/payload-sanitizer.js';
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

export class GeminiProvider implements AIProvider {
  public name = 'gemini';
  private apiKey: string;
  private modelName: string;
  private sanitizer: PayloadSanitizer;
  private mockFallback: MockProvider;

  constructor(apiKey?: string, modelName = 'gemini-2.5-flash') {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.modelName = modelName;
    this.sanitizer = new PayloadSanitizer();
    this.mockFallback = new MockProvider();
  }

  public async analyzeProject(profile: ProjectProfile): Promise<ProjectAnalysisResult> {
    if (!this.apiKey) return this.mockFallback.analyzeProject(profile);

    const safePayload = this.sanitizer.sanitizeProfile(profile);
    const prompt = `Analyze this software project profile for architecture risks.
Respond strictly in JSON adhering to:
{
  "summary": "string",
  "detectedArchitectureRisk": "string",
  "recommendedTestingStrategy": ["string"]
}

Project Profile:
${JSON.stringify(safePayload, null, 2)}`;

    try {
      const responseText = await this.callGeminiApi(prompt);
      const json = JSON.parse(responseText);
      return ProjectAnalysisSchema.parse(json);
    } catch (err) {
      return this.mockFallback.analyzeProject(profile);
    }
  }

  public async analyzeQAGaps(profile: ProjectProfile, results: ExecutionResult[]): Promise<QAGapAnalysisResult> {
    if (!this.apiKey) return this.mockFallback.analyzeQAGaps(profile, results);

    const safeProfile = this.sanitizer.sanitizeProfile(profile);
    const safeResults = this.sanitizer.sanitizeResults(results);

    const prompt = `You are PreFlight AI, a production readiness gatekeeper.
Analyze project profile and execution results. Do NOT change PASS/FAIL decisions.
Identify root causes for failures and suggest coverage gaps.

Respond strictly in JSON adhering to:
{
  "summary": "string",
  "rootCauseAnalyses": [{"resultId": "string", "possibleRootCause": "string", "risk": "string", "impact": "string", "confidence": "HIGH"|"MEDIUM"|"LOW", "suggestedFix": "string"}],
  "coverageGaps": [{"id": "string", "area": "string", "description": "string", "severity": "INFO"|"LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "recommendedAction": "string", "suggestedCapabilityId": "string"}],
  "additionalCheckRecommendations": [{"id": "string", "name": "string", "reason": "string", "command": "string"}]
}

Project Profile:
${JSON.stringify(safeProfile, null, 2)}

Execution Results:
${JSON.stringify(safeResults, null, 2)}`;

    try {
      const responseText = await this.callGeminiApi(prompt);
      const json = JSON.parse(responseText);
      return QAGapAnalysisSchema.parse(json);
    } catch (err) {
      return this.mockFallback.analyzeQAGaps(profile, results);
    }
  }

  public async analyzeDeploymentGaps(profile: ProjectProfile, results: ExecutionResult[]): Promise<DeploymentGapAnalysisResult> {
    if (!this.apiKey) return this.mockFallback.analyzeDeploymentGaps(profile, results);

    const safeProfile = this.sanitizer.sanitizeProfile(profile);
    const safeResults = this.sanitizer.sanitizeResults(results);

    const prompt = `Analyze deployment readiness check results for production risk.
Respond strictly in JSON adhering to:
{
  "summary": "string",
  "riskAssessment": "string",
  "recommendedChecks": [{"id": "string", "name": "string", "reason": "string"}]
}

Project Profile:
${JSON.stringify(safeProfile, null, 2)}

Execution Results:
${JSON.stringify(safeResults, null, 2)}`;

    try {
      const responseText = await this.callGeminiApi(prompt);
      const json = JSON.parse(responseText);
      return DeploymentGapAnalysisSchema.parse(json);
    } catch (err) {
      return this.mockFallback.analyzeDeploymentGaps(profile, results);
    }
  }

  public async analyzeFailure(failure: ExecutionResult): Promise<FailureAnalysisResult> {
    if (!this.apiKey) return this.mockFallback.analyzeFailure(failure);

    const safeResults = this.sanitizer.sanitizeResults([failure]);

    const prompt = `Analyze this execution failure and suggest a fix.
Respond strictly in JSON adhering to:
{
  "resultId": "string",
  "possibleRootCause": "string",
  "risk": "string",
  "impact": "string",
  "confidence": "HIGH"|"MEDIUM"|"LOW",
  "suggestedFix": "string"
}

Failure Detail:
${JSON.stringify(safeResults[0], null, 2)}`;

    try {
      const responseText = await this.callGeminiApi(prompt);
      const json = JSON.parse(responseText);
      return FailureAnalysisSchema.parse(json);
    } catch (err) {
      return this.mockFallback.analyzeFailure(failure);
    }
  }

  private async callGeminiApi(promptText: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!res.ok) {
      throw new Error(`Gemini API Error ${res.status}`);
    }

    const data: any = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  }
}
