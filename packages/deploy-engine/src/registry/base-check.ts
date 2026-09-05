import {
  ProjectProfile,
  ExecutionResult,
  Severity,
  Status
} from '@preflight/core';
import { DeployExecutionContext } from '../context/deploy-context.js';

export abstract class DeployCheck {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly category: 'structure' | 'environment' | 'runtime' | 'dependencies' | 'build' | 'git' | 'secrets' | 'database' | 'security' | 'seo' | 'hosting' | 'framework';
  public abstract readonly purpose: string;
  public abstract readonly severity: Severity;
  public abstract readonly remediation: string;

  public abstract isApplicable(profile: ProjectProfile): boolean;
  public abstract execute(ctx: DeployExecutionContext): Promise<ExecutionResult>;

  protected createSkippedResult(reason: string): ExecutionResult {
    return {
      id: `check-res-${this.id}-${Date.now()}`,
      targetId: this.id,
      name: this.name,
      type: 'check',
      status: 'SKIP',
      severity: 'INFO',
      durationMs: 0,
      evidence: {
        id: `ev-check-${Date.now()}`,
        stdout: `Check skipped: ${reason}`,
        stderr: '',
        exitCode: 0,
        durationMs: 0,
        artifacts: [],
        capturedAt: new Date().toISOString()
      },
      explanation: `Check '${this.name}' was skipped: ${reason}`,
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
      id: `check-res-${this.id}-${Date.now()}`,
      targetId: this.id,
      name: this.name,
      type: 'check',
      status,
      severity: this.severity,
      durationMs,
      evidence: {
        id: `ev-check-${Date.now()}`,
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
          id: `finding-check-${this.id}-${Date.now()}`,
          title: `Deployment Readiness Defect: ${this.name}`,
          description: explanation,
          severity: this.severity,
          status,
          remediation: this.remediation
        }
      ] : []
    };
  }
}
