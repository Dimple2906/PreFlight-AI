import { AIProvider } from '../provider.js';
import { AIAnalysis, ExecutionResult, ProjectProfile, AIAnalysisSchema } from '@preflight/core';
import { SecretSanitizer } from '@preflight/security';

export class GeminiAIProvider implements AIProvider {
  public name = 'gemini';
  private apiKey: string;
  private modelName: string;
  private sanitizer: SecretSanitizer;

  constructor(apiKey?: string, modelName = 'gemini-2.5-flash', sanitizer?: SecretSanitizer) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.modelName = modelName;
    this.sanitizer = sanitizer || new SecretSanitizer();
  }

  public async analyze(
    profile: ProjectProfile,
    results: ExecutionResult[]
  ): Promise<AIAnalysis> {
    if (!this.apiKey) {
      console.warn('[PreFlight AI Warning] GEMINI_API_KEY is missing. Falling back to offline Mock analysis.');
      const { MockAIProvider } = await import('./mock-provider.js');
      return new MockAIProvider().analyze(profile, results);
    }

    // Sanitize all inputs before constructing AI prompt payload
    const sanitizedResults = results.map(res => ({
      ...res,
      evidence: {
        ...res.evidence,
        stdout: this.sanitizer.sanitize(res.evidence.stdout).sanitizedText,
        stderr: this.sanitizer.sanitize(res.evidence.stderr).sanitizedText
      }
    }));

    // Perform HTTP API call to Gemini endpoint via standard fetch
    try {
      const prompt = `You are PreFlight AI, a production readiness gatekeeper.
Analyze the following project profile and deterministic execution results.
Do NOT attempt to change PASS/FAIL decisions.
Identify root causes for failures, detect coverage gaps, and suggest additional relevant checks.

Project Profile:
${JSON.stringify(profile, null, 2)}

Execution Results:
${JSON.stringify(sanitizedResults, null, 2)}

Respond with JSON adhering to:
{
  "summary": "string",
  "rootCauseAnalyses": [{"resultId": "string", "possibleRootCause": "string", "confidence": "HIGH"|"MEDIUM"|"LOW", "suggestedFix": "string"}],
  "coverageGaps": [{"id": "string", "area": "string", "description": "string", "severity": "INFO"|"LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "recommendedAction": "string"}],
  "additionalCheckRecommendations": [{"id": "string", "name": "string", "reason": "string", "command": "string"}]
}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (!res.ok) {
        throw new Error(`Gemini API HTTP error ${res.status}: ${await res.text()}`);
      }

      const json: any = await res.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(rawText);

      return AIAnalysisSchema.parse({
        summary: parsed.summary || 'AI Analysis complete.',
        rootCauseAnalyses: parsed.rootCauseAnalyses || [],
        coverageGaps: parsed.coverageGaps || [],
        additionalCheckRecommendations: parsed.additionalCheckRecommendations || [],
        sanitizedTokensCount: prompt.length,
        analyzedAt: new Date().toISOString()
      });
    } catch (err: any) {
      console.warn(`[PreFlight AI Error] Gemini provider analysis failed: ${err.message}. Falling back to Mock analysis.`);
      const { MockAIProvider } = await import('./mock-provider.js');
      return new MockAIProvider().analyze(profile, results);
    }
  }
}
