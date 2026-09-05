import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProjectInspector } from '@preflight/discovery';
import { ProjectClassifier } from '@preflight/classifier';
import { QAEngine, QARegistry } from '@preflight/qa-engine';
import { createAIProvider } from '@preflight/ai-engine';
import { SecretSanitizer } from '@preflight/security';
import { loadPreflightConfig } from '@preflight/config';
import {
  FinalReport,
  TestDefinition,
  ExecutionResult,
  Status,
  ExecutionContext,
  AIAnalysis,
  Logger
} from '@preflight/core';

export interface TestAppServiceOptions {
  projectPath: string;
  enableAi: boolean;
  configPath?: string;
  url?: string;
  concurrency?: number;
}

export class PreflightTestService {
  public async run(options: TestAppServiceOptions, ctx?: ExecutionContext): Promise<FinalReport> {
    const targetPath = path.resolve(options.projectPath);
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

    // 1. Unit & Integration Tests
    if (hasTestScript) {
      const tDef: TestDefinition = {
        id: 'qa-unit-tests',
        name: 'Unit & Integration Test Suite',
        description: 'Run project test runner to verify core invariants',
        category: 'unit',
        command: `${pm} test`,
        timeoutMs: 30000,
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

    // 2. Type Check
    const hasTsConfig = fs.existsSync(path.join(targetPath, 'tsconfig.json'));
    if (hasTypecheckScript || hasTsConfig) {
      const tDef: TestDefinition = {
        id: 'qa-typecheck',
        name: 'Adversarial Type Safety Verification',
        description: 'Verify strictly typed boundaries and non-null guarantees',
        category: 'boundary',
        command: hasTypecheckScript ? `${pm} run typecheck` : 'npx tsc --noEmit',
        timeoutMs: 30000,
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

    // 3. Applicable Adversarial Tests Execution
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
          results.push(this.createErrorResult({ id: test.id, name: test.name } as any, err));
        }
        executedTestIds.add(test.id);
      }
    }

    // AI Reasoning Advisor & Gap Analysis
    let aiAnalysis: AIAnalysis | undefined;
    if (options.enableAi && config.ai.enabled) {
      const aiProvider = createAIProvider(config.ai.provider, process.env.GEMINI_API_KEY);
      const qaGaps = await aiProvider.analyzeQAGaps(profile, results);

      if (qaGaps.coverageGaps && qaGaps.coverageGaps.length > 0) {
        for (const gap of qaGaps.coverageGaps) {
          const capId = (gap as any).suggestedCapabilityId || (gap as any).suggestedCheckCommand;
          if (capId && !executedTestIds.has(capId)) {
            const matchingTest = applicableTests.find((t) => t.id === capId || t.name === capId);
            if (matchingTest) {
              try {
                const extraResult = await matchingTest.execute({
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
              } catch (err: any) {
                results.push(this.createErrorResult({ id: matchingTest.id, name: matchingTest.name } as any, err));
              }
              executedTestIds.add(matchingTest.id);
            }
          }
        }
      }

      aiAnalysis = {
        summary: qaGaps.summary,
        rootCauseAnalyses: qaGaps.rootCauseAnalyses.map((rca) => ({
          resultId: rca.resultId,
          possibleRootCause: rca.possibleRootCause,
          confidence: rca.confidence,
          suggestedFix: rca.suggestedFix
        })),
        coverageGaps: qaGaps.coverageGaps.map((cg) => ({
          id: cg.id,
          area: cg.area,
          description: cg.description,
          severity: cg.severity,
          recommendedAction: cg.recommendedAction,
          suggestedCheckCommand: cg.suggestedCapabilityId
        })),
        additionalCheckRecommendations: qaGaps.additionalCheckRecommendations,
        sanitizedTokensCount: 150,
        analyzedAt: new Date().toISOString()
      };
    }

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
