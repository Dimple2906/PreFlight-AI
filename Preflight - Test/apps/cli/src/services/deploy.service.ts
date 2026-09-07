import path from 'node:path';
import { ProjectInspector } from '@preflight/discovery';
import { ProjectClassifier } from '@preflight/classifier';
import { DeployEngine, DeployRegistry } from '@preflight/deploy-engine';
import { AIEngine, PayloadSanitizer } from '@preflight/ai-engine';
import { SecretSanitizer } from '@preflight/security';
import { loadPreflightConfig } from '@preflight/config';
import {
  FinalReport,
  ExecutionResult,
  Status,
  ExecutionContext,
  Logger,
  AIAnalysis
} from '@preflight/core';

export interface DeployAppServiceOptions {
  projectPath: string;
  enableAi: boolean;
  configPath?: string;
  adaptive?: boolean;
  maxAdditionalChecks?: number;
}

export class PreflightDeployService {
  public async run(options: DeployAppServiceOptions, ctx?: ExecutionContext): Promise<FinalReport> {
    const targetPath = path.resolve(options.projectPath);
    const config = await loadPreflightConfig(targetPath);
    const inspector = new ProjectInspector();
    const discovered = await inspector.inspect(targetPath);

    const classifier = new ProjectClassifier();
    const profile = classifier.classify(discovered);

    const sanitizer = new SecretSanitizer();
    const deployEngine = new DeployEngine(sanitizer);
    const deployRegistry = new DeployRegistry();

    const logger = ctx?.logLevel ? new Logger(ctx.logLevel) : new Logger('normal');

    // Run Full Deployment Readiness Suite
    const initialSuite = await deployEngine.executeReadinessSuite(profile, logger);
    const results: ExecutionResult[] = initialSuite.map((res) => ({
      ...res,
      provenance: 'initial'
    }));

    const executedCheckIds = new Set<string>(results.map((r) => r.targetId));

    // AI Gap Analysis & Re-execution
    let aiAnalysis: AIAnalysis | undefined;
    if (options.enableAi && config.ai.enabled) {
      const aiEngine = new AIEngine({
        provider: config.ai.provider as any,
        apiKey: process.env.GEMINI_API_KEY,
        sanitizer: new PayloadSanitizer(sanitizer)
      });
      const aiStatus = aiEngine.getStatus();

      if (!aiStatus.available) {
        aiAnalysis = {
          summary: 'AI analysis unavailable (GEMINI_API_KEY missing, invalid, or API unreachable).',
          provider: (aiStatus.provider === 'gemini' ? 'gemini' : 'mock') as 'gemini' | 'mock',
          status: 'unavailable',
          rootCauseAnalyses: [],
          coverageGaps: [],
          additionalCheckRecommendations: [],
          sanitizedTokensCount: 0,
          analyzedAt: new Date().toISOString()
        };
      } else {
        try {
          const evidenceAnalysis = await aiEngine.analyzeEvidence(profile, results);

          // Deterministic Re-execution Loop: Merging AI-selected additional deployment checks
          if (options.adaptive !== false && evidenceAnalysis.coverageGaps && evidenceAnalysis.coverageGaps.length > 0) {
            const applicableChecks = deployRegistry.getApplicableChecks(profile);
            const maxAdditionalChecks = options.maxAdditionalChecks ?? 5;
            let added = 0;

            for (const gap of evidenceAnalysis.coverageGaps) {
              if (added >= maxAdditionalChecks) break;
              const checkId = gap.suggestedCapabilityId || gap.id;

              // Reject unknown, duplicate, command-containing, path-containing, or unsafe recommendations
              if (!checkId || typeof checkId !== 'string') continue;
              if (checkId.includes('/') || checkId.includes('\\') || checkId.includes(';') || checkId.includes('&') || checkId.includes('|') || checkId.includes('`') || checkId.includes('$') || checkId.includes(' ')) continue;

              if (!executedCheckIds.has(checkId)) {
                const matchingCheck = applicableChecks.find((c) => c.id === checkId || c.name === checkId);
                if (matchingCheck && !executedCheckIds.has(matchingCheck.id)) {
                  try {
                    const extraResult = await matchingCheck.execute({
                      projectRoot: profile.rootPath,
                      profile,
                      logger,
                      sanitizer
                    });
                    results.push({ ...extraResult, provenance: 'ai-selected' });
                    executedCheckIds.add(matchingCheck.id);
                    added++;
                  } catch (err: any) {
                    results.push({
                      id: `res-err-${matchingCheck.id}`,
                      targetId: matchingCheck.id,
                      name: matchingCheck.name,
                      type: 'check',
                      status: 'ERROR',
                      severity: 'HIGH',
                      durationMs: 0,
                      evidence: {
                        id: `ev-err-${Date.now()}`,
                        command: 'N/A',
                        stdout: '',
                        stderr: err.message || String(err),
                        exitCode: 1,
                        durationMs: 0,
                        artifacts: [],
                        capturedAt: new Date().toISOString()
                      },
                      explanation: `AI-selected deployment check failed: ${err.message || String(err)}`,
                      provenance: 'ai-selected',
                      findings: []
                    });
                  }
                  executedCheckIds.add(matchingCheck.id);
                }
              }
            }
          }

          aiAnalysis = {
            summary: evidenceAnalysis.summary,
            provider: (aiStatus.provider === 'gemini' ? 'gemini' : 'mock') as 'gemini' | 'mock',
            status: 'available',
            rootCauseAnalyses: evidenceAnalysis.rootCauseAnalyses.map((rca) => ({
              resultId: rca.resultId,
              possibleRootCause: rca.possibleRootCause,
              confidence: rca.confidence,
              suggestedFix: rca.suggestedFix
            })),
            coverageGaps: evidenceAnalysis.coverageGaps.map((cg) => ({
              id: cg.id,
              area: cg.area,
              description: cg.description,
              severity: cg.severity,
              recommendedAction: cg.recommendedAction,
              suggestedCapabilityId: cg.suggestedCapabilityId
            })),
            additionalCheckRecommendations: (evidenceAnalysis.remediationRecommendations || []).map((rec, idx) => ({
              id: `rec-deploy-${idx + 1}`,
              name: rec.area,
              reason: rec.action,
              command: undefined
            })),
            sanitizedTokensCount: 150,
            analyzedAt: new Date().toISOString()
          };
        } catch (err: any) {
          aiAnalysis = {
            summary: 'AI analysis unavailable due to API error.',
            provider: (aiStatus.provider === 'gemini' ? 'gemini' : 'mock') as 'gemini' | 'mock',
            status: 'unavailable',
            rootCauseAnalyses: [],
            coverageGaps: [],
            additionalCheckRecommendations: [],
            sanitizedTokensCount: 0,
            analyzedAt: new Date().toISOString()
          };
        }
      }
    }

    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    const warned = results.filter((r) => r.status === 'WARN').length;
    const errored = results.filter((r) => r.status === 'ERROR').length;
    const overallStatus: Status = failed > 0 || errored > 0 ? 'FAIL' : (warned > 0 ? 'WARN' : 'PASS');

    return {
      reportId: `report-deploy-${Date.now()}`,
      mode: 'deploy',
      overallStatus,
      projectProfile: profile,
      results,
      stats: {
        total: results.length,
        passed,
        failed,
        warned,
        skipped: 0,
        errored,
        durationMs: results.reduce((acc, r) => acc + r.durationMs, 0)
      },
      aiAnalysis,
      generatedAt: new Date().toISOString()
    };
  }
}

export const DeployAppService = PreflightDeployService;
