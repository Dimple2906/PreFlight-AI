import {
  CheckDefinition,
  ExecutionResult,
  ProjectProfile,
  Logger
} from '@preflight/core';
import { SecretSanitizer, ProcessExecutor } from '@preflight/security';
import { DeployRegistry } from '../registry/deploy-registry.js';
import { DeployRunner } from '../runner/deploy-runner.js';
import { DeployExecutionContext } from '../context/deploy-context.js';

export class DeployEngine {
  private registry: DeployRegistry;
  private runner: DeployRunner;
  private sanitizer: SecretSanitizer;

  constructor(sanitizer?: SecretSanitizer) {
    this.sanitizer = sanitizer || new SecretSanitizer();
    this.registry = new DeployRegistry();
    this.runner = new DeployRunner();
  }

  public async executeReadinessSuite(
    profile: ProjectProfile,
    logger = new Logger('normal')
  ): Promise<ExecutionResult[]> {
    const ctx: DeployExecutionContext = {
      projectRoot: profile.rootPath,
      profile,
      logger,
      sanitizer: this.sanitizer
    };

    const applicableChecks = this.registry.getApplicableChecks(profile);
    return this.runner.runChecks(applicableChecks, ctx);
  }

  public async executeCheck(
    checkDef: CheckDefinition,
    profile: ProjectProfile
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let exitCode: number | null = 0;
    let status: 'PASS' | 'FAIL' | 'ERROR' = 'PASS';
    let explanation = `Deployment check '${checkDef.name}' passed deterministically.`;

    if (checkDef.command) {
      const processRes = await ProcessExecutor.execute({
        command: checkDef.command,
        cwd: profile.rootPath,
        timeoutMs: 30000,
        maxBufferMb: 5,
        sanitizer: this.sanitizer
      });

      stdout = processRes.stdout;
      stderr = processRes.stderr;
      exitCode = processRes.exitCode;

      if (processRes.timedOut) {
        status = 'ERROR';
        explanation = `Deployment check timed out after 30000ms.`;
      } else if (exitCode !== 0) {
        status = 'FAIL';
        explanation = `Deployment check failed with exit code (${exitCode}).`;
      }
    } else {
      stdout = `Static check executed for ${checkDef.name}`;
    }

    const durationMs = Date.now() - startTime;
    const sanitizedStdout = this.sanitizer.sanitize(stdout).sanitizedText;
    const sanitizedStderr = this.sanitizer.sanitize(stderr).sanitizedText;

    return {
      id: `check-res-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      targetId: checkDef.id,
      name: checkDef.name,
      type: 'check',
      status,
      severity: status === 'PASS' ? 'INFO' : 'HIGH',
      durationMs,
      evidence: {
        id: `ev-check-${Date.now()}`,
        command: checkDef.command,
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
          id: `finding-check-${Date.now()}`,
          title: `Deployment Readiness Defect: ${checkDef.name}`,
          description: explanation,
          severity: 'HIGH',
          status,
          remediation: 'Resolve the underlying build, secret, or configuration issue before attempting release.'
        }
      ] : []
    };
  }
}
