import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProjectInspector } from '@preflight/discovery';
import { ProjectClassifier } from '@preflight/classifier';
import { QAEngine, QARegistry } from '@preflight/qa-engine';
import { AIEngine } from '@preflight/ai-engine';
import { SecretSanitizer } from '@preflight/security';
import { loadPreflightConfig } from '@preflight/config';
import {
  FinalReport,
  TestDefinition,
  ExecutionResult,
  Status,
  ExecutionContext,
  AIAnalysis,
  Logger,
  AIRecommendedPlanItem
} from '@preflight/core';

export interface TestAppServiceOptions {
  projectPath: string;
  enableAi: boolean;
  configPath?: string;
  url?: string;
  concurrency?: number;
  maxAdaptiveRounds?: number;
  onProgress?: (message: string) => void;
}

import { loadCliEnvironment } from '../utils/env.js';

export class PreflightTestService {
  public async run(options: TestAppServiceOptions, ctx?: ExecutionContext): Promise<FinalReport> {
    const targetPath = path.resolve(options.projectPath);
    loadCliEnvironment(targetPath);
    const config = await loadPreflightConfig(targetPath);
    const inspector = new ProjectInspector();
    const discovered = await inspector.inspect(targetPath);

    const classifier = new ProjectClassifier();
    const profile = classifier.classify(discovered);

    const sanitizer = new SecretSanitizer();
    const qaEngine = new QAEngine(sanitizer);
    const qaRegistry = new QARegistry();

    const results: ExecutionResult[] = [];
    const executedTestIds = new Set<string>();

    const pkgPath = path.join(targetPath, 'package.json');
    let hasTestScript = false;
    let hasTypecheckScript = false;

    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.scripts) {
          if (pkg.scripts.test) hasTestScript = true;
          if (pkg.scripts.typecheck) hasTypecheckScript = true;
        }
      } catch (err) {
        // ignore
      }
    }

    const pm = profile.packageManager === 'pnpm' ? 'pnpm' : profile.packageManager === 'yarn' ? 'yarn' : profile.packageManager === 'bun' ? 'bun' : 'npm';
    const isAiActive = options.enableAi && config.ai.enabled;
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
    const effectiveProvider: 'gemini' | 'mock' = isAiActive
      ? (config.ai.provider === 'mock' && !hasGeminiKey ? 'mock' : (config.ai.provider === 'gemini' || hasGeminiKey ? 'gemini' : 'mock'))
      : 'mock';

    const aiEngine = new AIEngine({
      provider: effectiveProvider,
      apiKey: process.env.GEMINI_API_KEY,
      modelName: config.ai.modelName
    });
    const aiStatus = aiEngine.getStatus();

    const logAi = (msg: string) => {
      if (options.onProgress) {
        options.onProgress(msg);
      } else if (!ctx?.logLevel || ctx.logLevel !== 'silent') {
        console.log(chalk.cyan(`  ${msg}`));
      }
    };

    if (isAiActive && aiStatus.provider === 'gemini') {
      logAi(`AI: Gemini enabled (model: ${aiStatus.model})`);
    }

    let aiRiskAnalysisRecord: any = undefined;
    const planItems: AIRecommendedPlanItem[] = [];
    const approvedAiTestsToRun: Array<{ id: string; name: string }> = [];

    // --- PHASE 1 & 2: AI RISK UNDERSTANDING & STRUCTURED TEST PLANNING ---
    if (isAiActive) {
      try {
        const riskAnalysis = await aiEngine.analyzeProjectRisk(profile);
        logAi('AI: Project analysis completed');
        aiRiskAnalysisRecord = {
          summary: riskAnalysis.summary,
          detectedArchitectureRisk: riskAnalysis.detectedArchitectureRisk,
          riskSignals: riskAnalysis.riskSignals || [],
          recommendedTestingStrategy: riskAnalysis.recommendedTestingStrategy || []
        };

        const capabilities = qaRegistry.getCapabilitiesList();
        const testPlan = await aiEngine.generateTestPlan(profile, capabilities);
        logAi(`AI: Test plan generated (${testPlan.recommendedTests.length} recommendations)`);

        for (const rec of testPlan.recommendedTests) {
          const validation = qaRegistry.validateRecommendation(rec.id, profile);
          if (validation.valid && validation.test) {
            planItems.push({
              id: rec.id,
              category: rec.category,
              title: rec.title,
              objective: rec.objective,
              rationale: rec.rationale,
              risk: rec.risk,
              status: 'APPROVED'
            });
            approvedAiTestsToRun.push({ id: validation.test.id, name: validation.test.name });
          } else {
            planItems.push({
              id: rec.id,
              category: rec.category,
              title: rec.title,
              objective: rec.objective,
              rationale: rec.rationale,
              risk: rec.risk,
              status: 'SKIPPED',
              skipReason: validation.reason || 'No compatible deterministic executor available in registry.'
            });

            results.push({
              id: `test-res-skip-${rec.id}-${Date.now()}`,
              targetId: rec.id,
              name: rec.title,
              type: 'test',
              status: 'SKIP',
              severity: 'INFO',
              durationMs: 0,
              evidence: {
                id: `ev-skip-${Date.now()}`,
                command: 'N/A',
                stdout: '',
                stderr: `AI recommendation skipped: ${validation.reason || 'No compatible deterministic executor available in registry.'}`,
                exitCode: 0,
                durationMs: 0,
                artifacts: [],
                capturedAt: new Date().toISOString()
              },
              explanation: `AI recommendation skipped: ${validation.reason || 'No compatible deterministic executor available in registry.'}`,
              provenance: 'ai-selected',
              findings: []
            });
            executedTestIds.add(rec.id);
          }
        }

        if (approvedAiTestsToRun.length > 0) {
          logAi(`AI: Selected registered tests: ${approvedAiTestsToRun.map(t => t.id).join(', ')}`);
        } else {
          logAi('AI: Selected registered tests: none (all recommended capabilities already matched or unsupported)');
        }
      } catch (err: any) {
        logAi(`AI: Gemini unavailable (${err.message || String(err)}). Falling back to deterministic testing.`);
        aiStatus.available = false;
      }
    }

    // --- PHASE 3: SAFE DETERMINISTIC TEST EXECUTION ---

    // 1. Unit & Integration Test Suite
    if (hasTestScript) {
      const tDef: TestDefinition = {
        id: 'qa-unit-tests',
        name: 'Unit & Integration Test Suite',
        description: 'Run project test runner to verify core invariants',
        category: 'unit',
        command: `${pm} test`,
        timeoutMs: Math.max(config.execution?.timeoutMs || 30000, 90000),
        environment: {}
      };
      try {
        const res = await qaEngine.executeTest(tDef, profile);
        results.push({ ...res, provenance: 'initial' });
      } catch (err: any) {
        results.push(this.createErrorResult(tDef, err));
      }
      executedTestIds.add(tDef.id);
    } else {
      results.push({
        id: 'test-res-qa-unit-tests-skipped',
        targetId: 'qa-unit-tests',
        name: 'Unit & Integration Test Suite',
        type: 'test',
        status: 'SKIP',
        severity: 'INFO',
        durationMs: 0,
        evidence: {
          id: `ev-skip-${Date.now()}`,
          command: 'N/A',
          stdout: '',
          stderr: 'No test script ("test") found in project package manifest.',
          exitCode: 0,
          durationMs: 0,
          artifacts: [],
          capturedAt: new Date().toISOString()
        },
        explanation: 'Skipped: No test script ("test") found in project package manifest.',
        provenance: 'initial',
        findings: []
      });
      executedTestIds.add('qa-unit-tests');
    }

    // 2. Adversarial Type Safety Verification
    const hasTsConfig = fs.existsSync(path.join(targetPath, 'tsconfig.json'));
    if (hasTypecheckScript || hasTsConfig) {
      const tDef: TestDefinition = {
        id: 'qa-typecheck',
        name: 'Adversarial Type Safety Verification',
        description: 'Verify strictly typed boundaries and non-null guarantees',
        category: 'boundary',
        command: hasTypecheckScript ? `${pm} run typecheck` : 'npx tsc --noEmit',
        timeoutMs: Math.max(config.execution?.timeoutMs || 30000, 90000),
        environment: {}
      };
      try {
        const res = await qaEngine.executeTest(tDef, profile);
        results.push({ ...res, provenance: 'initial' });
      } catch (err: any) {
        results.push(this.createErrorResult(tDef, err));
      }
      executedTestIds.add(tDef.id);
    } else {
      results.push({
        id: 'test-res-qa-typecheck-skipped',
        targetId: 'qa-typecheck',
        name: 'Adversarial Type Safety Verification',
        type: 'test',
        status: 'SKIP',
        severity: 'INFO',
        durationMs: 0,
        evidence: {
          id: `ev-skip-tc-${Date.now()}`,
          command: 'N/A',
          stdout: '',
          stderr: 'No typecheck script or tsconfig.json found in project.',
          exitCode: 0,
          durationMs: 0,
          artifacts: [],
          capturedAt: new Date().toISOString()
        },
        explanation: 'Skipped: No typecheck script or tsconfig.json found in project.',
        provenance: 'initial',
        findings: []
      });
      executedTestIds.add('qa-typecheck');
    }

    // 3. Deterministic Adversarial Tests
    const applicableTests = qaRegistry.getApplicableTests(profile);
    for (const test of applicableTests) {
      if (!executedTestIds.has(test.id)) {
        try {
          const res = await test.execute({
            projectRoot: profile.rootPath,
            profile,
            targetUrl: options.url,
            timeoutMs: 30000,
            maxConcurrency: options.concurrency || 4,
            environment: {},
            logger: ctx?.logLevel ? new Logger(ctx.logLevel) : new Logger('normal'),
            sanitizer
          });
          results.push({ ...res, provenance: 'initial' });
        } catch (err: any) {
          results.push(this.createErrorResult({ id: test.id, name: test.name }, err));
        }
        executedTestIds.add(test.id);
      }
    }

    // 4. AI-Approved Capability Tests
    for (const approved of approvedAiTestsToRun) {
      if (!executedTestIds.has(approved.id)) {
        const test = qaRegistry.findTest(approved.id);
        if (test) {
          try {
            const res = await test.execute({
              projectRoot: profile.rootPath,
              profile,
              targetUrl: options.url,
              timeoutMs: 30000,
              maxConcurrency: options.concurrency || 4,
              environment: {},
              logger: ctx?.logLevel ? new Logger(ctx.logLevel) : new Logger('normal'),
              sanitizer
            });
            results.push({ ...res, provenance: 'ai-selected' });
          } catch (err: any) {
            results.push(this.createErrorResult({ id: test.id, name: test.name }, err));
          }
          executedTestIds.add(test.id);
        }
      }
    }

    // --- PHASE 4: ADAPTIVE TEST LOOP (AI EVIDENCE & GAP ANALYSIS) ---
    let aiAnalysis: AIAnalysis | undefined;
    if (isAiActive) {
      const maxRounds = options.maxAdaptiveRounds !== undefined ? options.maxAdaptiveRounds : 2;
      let round = 0;

      while (round < maxRounds) {
        round++;
        logAi(`AI: Adaptive round ${round} initiated`);
        try {
          const capabilities = qaRegistry.getCapabilitiesList();
          const recommendations = await aiEngine.recommendAdditionalTests(profile, results, capabilities);
          let executedInRound = 0;

          for (const rec of recommendations) {
            const capId = rec.capabilityId || rec.id;
            if (capId && !executedTestIds.has(capId)) {
              const validation = qaRegistry.validateRecommendation(capId, profile);
              if (validation.valid && validation.test && !executedTestIds.has(validation.test.id)) {
                try {
                  const extraResult = await validation.test.execute({
                    projectRoot: profile.rootPath,
                    profile,
                    targetUrl: options.url,
                    timeoutMs: 30000,
                    maxConcurrency: options.concurrency || 4,
                    environment: {},
                    logger: ctx?.logLevel ? new Logger(ctx.logLevel) : new Logger('normal'),
                    sanitizer
                  });
                  results.push({ ...extraResult, provenance: 'ai-selected' });
                  executedTestIds.add(validation.test.id);
                  executedInRound++;
                } catch (err: any) {
                  results.push(this.createErrorResult({ id: validation.test.id, name: validation.test.name }, err));
                  executedTestIds.add(validation.test.id);
                }
              }
            }
          }

          // If no newly approved tests were executed in this round, loop ends
          if (executedInRound === 0) {
            break;
          }
        } catch (err) {
          break;
        }
      }

      // Final Evidence Analysis & Remediation
      try {
        const evidenceAnalysis = await aiEngine.analyzeEvidence(profile, results);
        logAi('AI: Evidence analysis completed');
        aiAnalysis = {
          summary: evidenceAnalysis.summary,
          provider: aiStatus.provider === 'gemini' ? 'gemini' : 'mock',
          status: aiStatus.available ? 'available' : 'unavailable',
          riskAnalysis: aiRiskAnalysisRecord,
          testPlan: planItems,
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
            id: `rec-${idx + 1}`,
            name: rec.area,
            reason: rec.action,
            command: undefined
          })),
          sanitizedTokensCount: 200,
          analyzedAt: new Date().toISOString()
        };
      } catch (err: any) {
        logAi(`AI: Evidence analysis failed (${err.message || String(err)}). Reporting AI unavailable.`);
        aiAnalysis = {
          summary: 'AI analysis unavailable due to API error.',
          provider: aiStatus.provider === 'gemini' ? 'gemini' : 'mock',
          status: 'unavailable',
          riskAnalysis: undefined,
          testPlan: [],
          rootCauseAnalyses: [],
          coverageGaps: [],
          additionalCheckRecommendations: [],
          sanitizedTokensCount: 0,
          analyzedAt: new Date().toISOString()
        };
      }
    }

    // --- PHASE 5: DETERMINISTIC VERDICT GENERATION ---
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    const warned = results.filter((r) => r.status === 'WARN').length;
    const skipped = results.filter((r) => r.status === 'SKIP').length;
    const errored = results.filter((r) => r.status === 'ERROR').length;
    const overallStatus: Status = failed > 0 || errored > 0 ? 'FAIL' : (warned > 0 ? 'WARN' : 'PASS');

    return {
      reportId: `report-test-${Date.now()}`,
      mode: 'test',
      overallStatus,
      projectProfile: profile,
      results,
      stats: {
        total: results.length,
        passed,
        failed,
        warned,
        skipped,
        errored,
        durationMs: results.reduce((acc, r) => acc + r.durationMs, 0)
      },
      aiAnalysis,
      generatedAt: new Date().toISOString()
    };
  }

  private createErrorResult(tDef: { id: string; name: string }, err: any): ExecutionResult {
    return {
      id: `res-err-${tDef.id}-${Date.now()}`,
      targetId: tDef.id,
      name: tDef.name,
      type: 'test',
      status: 'ERROR',
      severity: 'HIGH',
      durationMs: 0,
      evidence: {
        id: `ev-err-${Date.now()}`,
        stdout: '',
        stderr: err.message || String(err),
        exitCode: 1,
        durationMs: 0,
        artifacts: [],
        capturedAt: new Date().toISOString()
      },
      explanation: `Test execution failed with unhandled exception: ${err.message || String(err)}`,
      provenance: 'initial',
      findings: []
    };
  }
}

export const TestAppService = PreflightTestService;
