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

export class GeminiProvider implements AIProvider {
  public readonly name = 'gemini';
  private apiKey: string;
  private modelName: string;
  private mockFallback: MockAIProvider;
  public lastError: string | null = null;

  constructor(apiKey?: string, modelName = 'gemini-3.6-flash') {
    this.apiKey = apiKey !== undefined ? apiKey : (process.env.GEMINI_API_KEY || '');
    this.modelName = modelName;
    this.mockFallback = new MockAIProvider();
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && !this.lastError);
  }

  public async analyzeProject(context: ProjectContext): Promise<ProjectAnalysis> {
    if (!this.isAvailable()) {
      return this.mockFallback.analyzeProject(context);
    }

    const prompt = buildRiskAnalysisPrompt(context);
    try {
      const responseText = await this.callGeminiApi(prompt);
      const json = JSON.parse(responseText);
      this.lastError = null;
      return ProjectAnalysisSchema.parse(json);
    } catch (err: any) {
      this.lastError = err.message || String(err);
      throw err;
    }
  }

  public async generateTestPlan(context: TestPlanningContext): Promise<TestPlan> {
    if (!this.isAvailable()) {
      return this.mockFallback.generateTestPlan(context);
    }

    const prompt = buildTestPlannerPrompt(context);
    try {
      const responseText = await this.callGeminiApi(prompt);
      const json = JSON.parse(responseText);
      this.lastError = null;
      return TestPlanSchema.parse(json);
    } catch (err: any) {
      this.lastError = err.message || String(err);
      throw err;
    }
  }

  public async analyzeEvidence(context: EvidenceContext): Promise<EvidenceAnalysis> {
    if (!this.isAvailable()) {
      return this.mockFallback.analyzeEvidence(context);
    }

    const prompt = buildEvidenceAnalysisPrompt(context);
    try {
      const responseText = await this.callGeminiApi(prompt);
      const json = JSON.parse(responseText);
      this.lastError = null;
      return EvidenceAnalysisSchema.parse(json);
    } catch (err: any) {
      this.lastError = err.message || String(err);
      throw err;
    }
  }

  public async recommendAdditionalTests(context: GapAnalysisContext): Promise<TestRecommendation[]> {
    if (!this.isAvailable()) {
      return this.mockFallback.recommendAdditionalTests(context);
    }

    const prompt = buildGapAnalysisPrompt(context);
    try {
      const responseText = await this.callGeminiApi(prompt);
      const json = JSON.parse(responseText);
      const schema = z.array(TestRecommendationSchema);
      this.lastError = null;
      return schema.parse(json);
    } catch (err: any) {
      this.lastError = err.message || String(err);
      throw err;
    }
  }

  private async callGeminiApi(promptText: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
            await new Promise((r) => setTimeout(r, 1500 * attempt));
            continue;
          }

          throw new Error(`Gemini API Error ${res.status}: ${parsedMessage}`);
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
        lastErr = err;
        if (attempt < 3 && (err.message?.includes('503') || err.message?.includes('429'))) {
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }
}
