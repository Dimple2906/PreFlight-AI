import {
  TestDefinition,
  ExecutionResult,
  ProjectProfile,
  PreflightStatus,
  Severity
} from '@preflight/core';
import { SecretSanitizer, ProcessExecutor } from '@preflight/security';

export class QAEngine {
  private sanitizer: SecretSanitizer;

  constructor(sanitizer?: SecretSanitizer) {
    this.sanitizer = sanitizer || new SecretSanitizer();
  }

  public async executeTest(
    testDef: TestDefinition,
    profile: ProjectProfile
  ): Promise<ExecutionResult> {
    let status: PreflightStatus = 'PASS';
    let severity: Severity = 'INFO';
    let explanation = `Deterministic adversarial test '${testDef.name}' completed successfully.`;

    const processRes = await ProcessExecutor.execute({
      command: testDef.command,
      cwd: profile.rootPath,
      timeoutMs: testDef.timeoutMs || 30000,
      maxBufferMb: 5,
      environment: testDef.environment,
      sanitizer: this.sanitizer
    });

    if (processRes.timedOut) {
      status = 'ERROR';
      severity = 'CRITICAL';
      explanation = `Adversarial test timed out after ${testDef.timeoutMs || 30000}ms.`;
    } else if (processRes.exitCode !== 0) {
      status = 'FAIL';
      severity = 'HIGH';
      explanation = `Adversarial test failed with non-zero exit code (${processRes.exitCode}).`;
    }

    return {
      id: `test-res-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      targetId: testDef.id,
      name: testDef.name,
      type: 'test',
      status,
      severity,
      durationMs: processRes.durationMs,
      evidence: {
        id: `ev-${Date.now()}`,
        command: testDef.command,
        stdout: processRes.stdout,
        stderr: processRes.stderr,
        exitCode: processRes.exitCode,
        durationMs: processRes.durationMs,
        artifacts: [],
        capturedAt: new Date().toISOString()
      },
      explanation,
      findings: status === 'FAIL' || status === 'ERROR' ? [
        {
          id: `finding-${Date.now()}`,
          title: `Test Failure: ${testDef.name}`,
          description: explanation,
          severity,
          status,
          remediation: 'Check captured test evidence stdout/stderr for exact root cause details.'
        }
      ] : []
    };
  }
}
