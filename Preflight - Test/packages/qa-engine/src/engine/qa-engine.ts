import {
  TestDefinition,
  ExecutionResult,
  ProjectProfile,
  Logger
} from '@preflight/core';
import { SecretSanitizer } from '@preflight/security';
import { QARegistry } from '../registry/qa-registry.js';
import { QARunner } from '../runner/qa-runner.js';
import { QAExecutionContext } from '../context/qa-context.js';
import { execa } from 'execa';

export class QAEngine {
  private registry: QARegistry;
  private runner: QARunner;
  private sanitizer: SecretSanitizer;

  constructor(sanitizer?: SecretSanitizer) {
    this.sanitizer = sanitizer || new SecretSanitizer();
    this.registry = new QARegistry();
    this.runner = new QARunner();
  }

  public async executeAdversarialSuite(
    profile: ProjectProfile,
    targetUrl?: string,
    logger = new Logger('normal')
  ): Promise<ExecutionResult[]> {
    const ctx: QAExecutionContext = {
      projectRoot: profile.rootPath,
      profile,
      targetUrl,
      timeoutMs: 30000,
      maxConcurrency: 4,
      environment: {},
      logger,
      sanitizer: this.sanitizer
    };

    const applicableTests = this.registry.getApplicableTests(profile);
    return this.runner.runTests(applicableTests, ctx);
  }

  public async executeTest(
    testDef: TestDefinition,
    profile: ProjectProfile
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let exitCode: number | null = 0;
    let status: 'PASS' | 'FAIL' | 'ERROR' = 'PASS';
    let explanation = `Deterministic test '${testDef.name}' completed successfully.`;

    try {
      const parts = testDef.command.split(' ');
      const binary = parts[0];
      const args = parts.slice(1);

      const result = await execa(binary, args, {
        cwd: profile.rootPath,
        reject: false,
        timeout: testDef.timeoutMs,
        env: { ...process.env, ...testDef.environment }
      });

      stdout = result.stdout;
      stderr = result.stderr;
      exitCode = result.exitCode ?? null;

      if (result.timedOut) {
        status = 'ERROR';
        explanation = `Deterministic test timed out after ${testDef.timeoutMs}ms.`;
      } else if (exitCode !== 0) {
        status = 'FAIL';
        explanation = `Adversarial test failed with exit code (${exitCode}).`;
      }
    } catch (err: any) {
      status = 'ERROR';
      stderr = err.message || String(err);
      exitCode = 1;
      explanation = `Execution error: ${err.message}`;
    }

    const durationMs = Date.now() - startTime;
    const sanitizedStdout = this.sanitizer.sanitize(stdout).sanitizedText;
    const sanitizedStderr = this.sanitizer.sanitize(stderr).sanitizedText;

    return {
      id: `test-res-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      targetId: testDef.id,
      name: testDef.name,
      type: 'test',
      status,
      severity: status === 'PASS' ? 'INFO' : 'HIGH',
      durationMs,
      evidence: {
        id: `ev-${Date.now()}`,
        command: testDef.command,
        stdout: sanitizedStdout,
        stderr: sanitizedStderr,
        exitCode,
        durationMs,
        artifacts: [],
        capturedAt: new Date().toISOString()
      },
      explanation,
      findings: status === 'FAIL' || status === 'ERROR' ? [
        {
          id: `finding-${Date.now()}`,
          title: `Test Failure: ${testDef.name}`,
          description: explanation,
          severity: 'HIGH',
          status,
          remediation: 'Inspect captured test evidence stdout/stderr for exact root cause details.'
        }
      ] : []
    };
  }
}
