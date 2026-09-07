import {
  ProjectProfile,
  ExecutionResult,
  Severity,
  Status
} from '@preflight/core';
import { QAExecutionContext } from '../context/qa-context.js';

export abstract class AdversarialTest {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly category: 'authentication' | 'authorization' | 'input' | 'api' | 'concurrency' | 'resilience' | 'security' | 'rate-limit';
  public abstract readonly purpose: string;
  public abstract readonly severity: Severity;
  public abstract readonly remediation: string;

  public abstract isApplicable(profile: ProjectProfile): boolean;
  public abstract execute(ctx: QAExecutionContext): Promise<ExecutionResult>;

  protected createSkippedResult(reason: string): ExecutionResult {
    return {
      id: `test-res-${this.id}-${Date.now()}`,
      targetId: this.id,
      name: this.name,
      type: 'test',
      status: 'SKIP',
      severity: 'INFO',
      durationMs: 0,
      evidence: {
        id: `ev-${Date.now()}`,
        stdout: `Test skipped: ${reason}`,
        stderr: '',
        exitCode: 0,
        durationMs: 0,
        artifacts: [],
        capturedAt: new Date().toISOString()
      },
      explanation: `Test '${this.name}' was skipped: ${reason}`,
      findings: []
    };
  }

  protected createResult(
    status: Status,
    durationMs: number,
    explanation: string,
    stdout: string,
    stderr: string,
    exitCode: number | null = 0,
    findingsCount = status === 'FAIL' || status === 'ERROR' ? 1 : 0
  ): ExecutionResult {
    return {
      id: `test-res-${this.id}-${Date.now()}`,
      targetId: this.id,
      name: this.name,
      type: 'test',
      status,
      severity: this.severity,
      durationMs,
      evidence: {
        id: `ev-${Date.now()}`,
        stdout,
        stderr,
        exitCode,
        durationMs,
        artifacts: [],
        capturedAt: new Date().toISOString()
      },
      explanation,
      findings: findingsCount > 0 ? [
        {
          id: `finding-${this.id}-${Date.now()}`,
          title: `Adversarial Vulnerability: ${this.name}`,
          description: explanation,
          severity: this.severity,
          status,
          remediation: this.remediation
        }
      ] : []
    };
  }
}
