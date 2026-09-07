import * as https from 'https';
import { AIAnalysis, AIAnalysisContext, EngineAIReport } from '../types';
import { sanitizeForAI } from '../utils/sanitize';

/**
 * Default Gemini model used for root-cause deployment readiness analysis.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

/**
 * Configuration options for the Gemini AI client.
 */
export interface GeminiClientOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Controlled system prompt enforcing strict deterministic authority,
 * zero credential leakage, and structured JSON output.
 */
export const SYSTEM_PROMPT = `You are the root-cause analysis layer of PreFlight AI, a deployment-readiness tool.
The deterministic check result provided in the user prompt is authoritative.
Do not change PASS, FAIL, WARN, SKIPPED, ERROR, severity, or deployment readiness.
Do not invent evidence.
Do not claim that a check passed when the deterministic engine says it failed.
Explain the likely root cause using only the supplied evidence and project context.
Provide practical remediation steps.
Never request, reproduce, expose, or infer secret values.
Return structured JSON only matching the schema:
{
  "rootCause": "Clear explanation of why this check failed based strictly on the provided context",
  "risk": "Technical deployment risk or production failure mode if not addressed",
  "explanation": "Detailed technical explanation of the issue in the context of the technology stack",
  "remediation": ["Actionable step 1", "Actionable step 2", "Actionable step 3"],
  "confidence": 0.95
}`;

/**
 * Sanitizes an AIAnalysisContext before transmission to external API.
 */
export function sanitizeContext(ctx: AIAnalysisContext): AIAnalysisContext {
  return {
    checkId: ctx.checkId,
    checkName: ctx.checkName,
    severity: ctx.severity,
    status: ctx.status,
    message: sanitizeForAI(ctx.message),
    evidence: ctx.evidence ? ctx.evidence.map((e) => sanitizeForAI(e)) : undefined,
    remediation: ctx.remediation
      ? {
          summary: sanitizeForAI(ctx.remediation.summary),
          guidance: ctx.remediation.guidance ? sanitizeForAI(ctx.remediation.guidance) : undefined,
          steps: ctx.remediation.steps ? ctx.remediation.steps.map((s) => sanitizeForAI(s)) : undefined,
          autoFixable: ctx.remediation.autoFixable,
        }
      : undefined,
    projectType: ctx.projectType,
    framework: ctx.framework,
    runtime: ctx.runtime,
    hosting: ctx.hosting,
    subProjectName: ctx.subProjectName,
  };
}

/**
 * Constructs user prompt for analyzing a single check failure.
 */
export function buildAnalysisPrompt(ctx: AIAnalysisContext): string {
  const sCtx = sanitizeContext(ctx);
  const parts: string[] = [
    `PROJECT CONTEXT:`,
    `- Type: ${sCtx.projectType || 'unknown'}`,
    `- Framework: ${sCtx.framework || 'unknown'}`,
    `- Runtime: ${sCtx.runtime || 'unknown'}`,
    `- Hosting: ${sCtx.hosting || 'unknown'}`,
  ];

  if (sCtx.subProjectName) {
    parts.push(`- Sub-project: ${sCtx.subProjectName}`);
  }

  parts.push(
    `\nCHECK EVALUATION:`,
    `- Check ID: ${sCtx.checkId}`,
    `- Name: ${sCtx.checkName}`,
    `- Status: ${sCtx.status}`,
    `- Severity: ${sCtx.severity}`,
    `- Failure Message: ${sCtx.message}`
  );

  if (sCtx.evidence && sCtx.evidence.length > 0) {
    parts.push(`\nEVIDENCE:`);
    for (const ev of sCtx.evidence) {
      parts.push(`- ${ev}`);
    }
  }

  if (sCtx.remediation) {
    parts.push(`\nEXISTING REMEDIATION METADATA:`);
    parts.push(`- Summary: ${sCtx.remediation.summary}`);
    if (sCtx.remediation.steps && sCtx.remediation.steps.length > 0) {
      for (const step of sCtx.remediation.steps) {
        parts.push(`- Step: ${step}`);
      }
    }
  }

  parts.push(
    `\nAnalyze this failure and return JSON with rootCause, risk, explanation, remediation (array of strings), and confidence (number between 0 and 1).`
  );

  return parts.join('\n');
}

/**
 * Validates and normalizes raw JSON output from Gemini into an AIAnalysis object.
 */
export function parseAndValidateAIResponse(checkId: string, rawText: string): AIAnalysis | null {
  if (!rawText || typeof rawText !== 'string') return null;

  try {
    // Strip markdown code block fences if present (```json ... ```)
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object') return null;

    // Strict validation: rootCause, risk, and explanation must be provided by the AI
    if (typeof parsed.rootCause !== 'string' || parsed.rootCause.trim().length === 0) {
      return null;
    }
    if (typeof parsed.risk !== 'string' || parsed.risk.trim().length === 0) {
      return null;
    }
    if (typeof parsed.explanation !== 'string' || parsed.explanation.trim().length === 0) {
      return null;
    }

    const rootCause = parsed.rootCause.trim();
    const risk = parsed.risk.trim();
    const explanation = parsed.explanation.trim();

    let remediation: string[] = [];
    if (Array.isArray(parsed.remediation)) {
      remediation = parsed.remediation
        .filter((s: any) => typeof s === 'string' && s.trim().length > 0)
        .map((s: string) => s.trim());
    } else if (typeof parsed.remediation === 'string' && parsed.remediation.trim().length > 0) {
      remediation = [parsed.remediation.trim()];
    }

    if (remediation.length === 0) {
      return null;
    }

    const confidence = typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1
      ? parsed.confidence
      : 0.85;

    return {
      checkId,
      rootCause,
      risk,
      explanation,
      remediation,
      confidence,
    };
  } catch {
    return null;
  }
}

/**
 * Makes an HTTPS request to the Google Gemini REST API.
 */
function sendGeminiRequest(
  apiKey: string,
  model: string,
  prompt: string,
  timeoutMs = 15000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        response_mime_type: 'application/json',
      },
    });

    const options: https.RequestOptions = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: timeoutMs,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          return reject(new Error(`Gemini API responded with status ${res.statusCode}: ${body.slice(0, 300)}`));
        }

        try {
          const json = JSON.parse(body);
          const candidate = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!candidate) {
            return reject(new Error('No candidate content text found in Gemini response'));
          }
          resolve(candidate);
        } catch (e: any) {
          reject(new Error(`Failed to parse Gemini response JSON: ${e.message}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Gemini API request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Analyzes a single failed or warning check using Gemini.
 * Returns null if analysis fails or API is unavailable.
 * Never throws exceptions upward.
 */
export async function analyzeDeploymentFailure(
  context: AIAnalysisContext,
  options: GeminiClientOptions = {}
): Promise<AIAnalysis | null> {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }

  const model = options.model || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const timeoutMs = options.timeoutMs ?? 10000;

  try {
    const prompt = buildAnalysisPrompt(context);
    const rawText = await sendGeminiRequest(apiKey, model, prompt, timeoutMs);
    return parseAndValidateAIResponse(context.checkId, rawText);
  } catch {
    return null;
  }
}

/**
 * Analyzes multiple failure contexts with bounded concurrency and request caps.
 * Avoids excessive API calls: analyzes at most `maxChecksToAnalyze` failures (default: 5).
 * Never crashes or disrupts deterministic execution.
 */
export async function analyzeFailuresBatch(
  contexts: AIAnalysisContext[],
  options: GeminiClientOptions & { maxChecksToAnalyze?: number } = {}
): Promise<EngineAIReport> {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
  const model = options.model || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

  if (!apiKey || apiKey.trim() === '') {
    return {
      status: 'UNAVAILABLE',
      model,
      analyzedChecksCount: 0,
      analyses: {},
      error: 'GEMINI_API_KEY not configured in environment',
    };
  }

  // Filter to meaningful failures (CRITICAL, HIGH, and ERROR checks only)
  const prioritized = contexts.filter(
    (c) => c.status === 'ERROR' || c.severity === 'CRITICAL' || c.severity === 'HIGH'
  );
  const targetContexts = prioritized.length > 0 ? prioritized : contexts;
  const maxChecks = options.maxChecksToAnalyze ?? 5;
  const selectedContexts = targetContexts.slice(0, maxChecks);

  if (selectedContexts.length === 0) {
    return {
      status: 'SKIPPED',
      model,
      analyzedChecksCount: 0,
      analyses: {},
    };
  }

  const analyses: Record<string, AIAnalysis> = {};

  for (const ctx of selectedContexts) {
    const res = await analyzeDeploymentFailure(ctx, options);
    if (res) {
      analyses[ctx.checkId] = res;
    }
  }

  const count = Object.keys(analyses).length;

  return {
    status: count > 0 ? 'AVAILABLE' : 'ERROR',
    model,
    analyzedChecksCount: count,
    analyses,
    error: count === 0 ? 'Failed to obtain structured analysis from Gemini' : undefined,
  };
}
