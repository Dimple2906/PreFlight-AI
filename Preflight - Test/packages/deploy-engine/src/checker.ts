import { execa } from 'execa';
import {
  CheckDefinition,
  ExecutionResult,
  ProjectProfile,
  PreflightStatus,
  Severity
} from '@preflight/core';
import { SecretSanitizer } from '@preflight/security';

export class DeployEngine {
  private sanitizer: SecretSanitizer;

  constructor(sanitizer?: SecretSanitizer) {
    this.sanitizer = sanitizer || new SecretSanitizer();
  }

  public async executeCheck(
    checkDef: CheckDefinition,
    profile: ProjectProfile
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let exitCode: number | null = 0;
    let status: PreflightStatus = 'PASS';
    let severity: Severity = 'INFO';
    let explanation = `Deployment check '${checkDef.name}' passed deterministically.`;

    if (checkDef.command) {
      try {
        const parts = checkDef.command.split(' ');
        const binary = parts[0];
        const args = parts.slice(1);

        const result = await execa(binary, args, {
          cwd: profile.rootPath,
          reject: false,
          timeout: 30000
        });

        stdout = result.stdout;
        stderr = result.stderr;
        exitCode = result.exitCode ?? null;

        if (exitCode !== 0) {
          status = 'FAIL';
          severity = 'HIGH';
          explanation = `Deployment readiness check command failed (exit code ${exitCode}).`;
        }
      } catch (err: any) {
        status = 'ERROR';
        severity = 'CRITICAL';
        stderr = err.message || String(err);
        exitCode = 1;
        explanation = `Check execution error: ${err.message}`;
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
      severity,
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
          title: `Deployment Gate Unready: ${checkDef.name}`,
          description: explanation,
          severity,
          status,
          remediation: 'Resolve the underlying build, secret, or deployment configuration issue before attempting release.'
        }
      ] : []
    };
  }
}
