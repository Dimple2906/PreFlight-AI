import { AIProvider } from '../AIProvider.js';
import { MockAIProvider } from '../mock/MockAIProvider.js';
import {
  ProjectContext,
  ProjectAnalysis,
  ProjectAnalysisSchema,
  TestPlanningContext,
  TestPlan,
  TestPlanSchema,
  EvidenceContext,
  EvidenceAnalysis,
  EvidenceAnalysisSchema,
  GapAnalysisContext,
  TestRecommendation,
  TestRecommendationSchema
} from '../../schemas/ai-response.js';
import { buildRiskAnalysisPrompt } from '../../prompts/risk-analysis.js';
import { buildTestPlannerPrompt } from '../../prompts/test-planner.js';
import { buildEvidenceAnalysisPrompt } from '../../prompts/evidence-analysis.js';
import { buildGapAnalysisPrompt } from '../../prompts/gap-analysis.js';
import { z } from 'zod';

function sanitizeErrorMessage(msg: string, key?: string): string {
  let cleaned = msg || '';
  if (key && key.trim().length > 0) {
    cleaned = cleaned.replaceAll(key, '[REDACTED]');
  }
  cleaned = cleaned.replace(/AIza[0-9A-Za-z\-_]{35}/g, '[REDACTED]');
  cleaned = cleaned.replace(/AQ\.[0-9A-Za-z\-_]{20,}/g, '[REDACTED]');
  return cleaned;
}

export class GeminiProvider implements AIProvider {
  public readonly name = 'gemini';
  private apiKey: string;
  private modelName: string;
  public lastError: string | null = null;

  constructor(apiKey?: string, modelName = 'gemini-3.5-flash-lite') {
    this.apiKey = apiKey !== undefined ? apiKey : (process.env.GEMINI_API_KEY || '');
    this.modelName = modelName;
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && !this.lastError);
  }

  public async analyzeProject(context: ProjectContext): Promise<ProjectAnalysis> {
    if (!this.isAvailable()) {
      throw new Error(`Gemini provider unavailable: ${this.lastError || 'GEMINI_API_KEY missing or invalid'}`);
    }

    const prompt = buildRiskAnalysisPrompt(context);
    try {
      const responseText = await this.callGeminiApi(prompt);
      const json = JSON.parse(responseText);
      this.lastError = null;
      return ProjectAnalysisSchema.parse(json);
    } catch (err: any) {
      const sanitized = sanitizeErrorMessage(err.message || String(err), this.apiKey);
      this.lastError = sanitized;
      throw new Error(sanitized);
    }
  }

  public async generateTestPlan(context: TestPlanningContext): Promise<TestPlan> {
    if (!this.isAvailable()) {
      throw new Error(`Gemini provider unavailable: ${this.lastError || 'GEMINI_API_KEY missing or invalid'}`);
    }

    const prompt = buildTestPlannerPrompt(context);
    try {
      const responseText = await this.callGeminiApi(prompt);
      const json = JSON.parse(responseText);
      this.lastError = null;
      return TestPlanSchema.parse(json);
    } catch (err: any) {
      const sanitized = sanitizeErrorMessage(err.message || String(err), this.apiKey);
      this.lastError = sanitized;
      throw new Error(sanitized);
    }
  }

  public async analyzeEvidence(context: EvidenceContext): Promise<EvidenceAnalysis> {
    if (!this.isAvailable()) {
      throw new Error(`Gemini provider unavailable: ${this.lastError || 'GEMINI_API_KEY missing or invalid'}`);
    }

    const prompt = buildEvidenceAnalysisPrompt(context);
    try {
      const responseText = await this.callGeminiApi(prompt);
      const json = JSON.parse(responseText);
      this.lastError = null;
      return EvidenceAnalysisSchema.parse(json);
    } catch (err: any) {
      const sanitized = sanitizeErrorMessage(err.message || String(err), this.apiKey);
      this.lastError = sanitized;
      throw new Error(sanitized);
    }
  }

  public async recommendAdditionalTests(context: GapAnalysisContext): Promise<TestRecommendation[]> {
    if (!this.isAvailable()) {
      throw new Error(`Gemini provider unavailable: ${this.lastError || 'GEMINI_API_KEY missing or invalid'}`);
    }

    const prompt = buildGapAnalysisPrompt(context);
    try {
      const responseText = await this.callGeminiApi(prompt);
      const json = JSON.parse(responseText);
      const schema = z.array(TestRecommendationSchema);
      this.lastError = null;
      return schema.parse(json);
    } catch (err: any) {
      const sanitized = sanitizeErrorMessage(err.message || String(err), this.apiKey);
      this.lastError = sanitized;
      throw new Error(sanitized);
    }
  }

  private async callGeminiApi(promptText: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent`;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          let parsedMessage = errBody;
          try {
            const parsed = JSON.parse(errBody);
            if (parsed.error?.message) parsedMessage = parsed.error.message;
          } catch {
            // ignore
          }

          if ((res.status === 503 || res.status === 429) && attempt < 3) {
            const retryMatch = parsedMessage.match(/retry in ([0-9.]+)s/i);
            const waitMs = retryMatch ? Math.min(Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000, 35000) : 1500 * attempt;
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }

          throw new Error(`Gemini API Error ${res.status}: ${sanitizeErrorMessage(parsedMessage, this.apiKey)}`);
        }

        const data: any = await res.json();
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        if (text.includes('```json')) {
          text = text.replace(/```json\s*([\s\S]*?)\s*```/g, '$1');
        } else if (text.includes('```')) {
          text = text.replace(/```\s*([\s\S]*?)\s*```/g, '$1');
        }
        return text.trim();
      } catch (err: any) {
        lastErr = new Error(sanitizeErrorMessage(err.message || String(err), this.apiKey));
        if (attempt < 3 && (err.message?.includes('503') || err.message?.includes('429'))) {
          const retryMatch = err.message.match(/retry in ([0-9.]+)s/i);
          const waitMs = retryMatch ? Math.min(Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000, 35000) : 1500 * attempt;
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw lastErr;
      }
    }
    throw lastErr;
  }
}
