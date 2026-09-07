import { AdversarialTest } from '../../registry/base-test.js';
import { QAExecutionContext } from '../../context/qa-context.js';
import { HttpAttacker } from '../../attacks/http-attacker.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class Api001HealthCheckProbe extends AdversarialTest {
  public readonly id = 'API-001';
  public readonly name = 'API Health & Readiness Contract Probe';
  public readonly category = 'api' as any;
  public readonly purpose = 'Verify health and readiness endpoints respond with HTTP 200 within SLA thresholds';
  public readonly severity = 'HIGH' as const;
  public readonly remediation = 'Expose a standard /health or /api/health endpoint returning service status.';

  public isApplicable(profile: ProjectProfile): boolean {
    return profile.projectType === 'fullstack' || profile.projectType === 'web-app';
  }

  public async execute(ctx: QAExecutionContext): Promise<ExecutionResult> {
    if (!ctx.targetUrl) {
      return this.createSkippedResult('No target URL provided for active HTTP probing.');
    }

    const attacker = new HttpAttacker(ctx.sanitizer);
    const probe = await attacker.probe(`${ctx.targetUrl}/health`, { method: 'GET' });

    if (probe.status === 200) {
      return this.createResult(
        'PASS',
        probe.durationMs,
        `Health endpoint /health responded HTTP 200 in ${probe.durationMs}ms.`,
        `Status: 200\nResponse Time: ${probe.durationMs}ms`,
        ''
      );
    }

    const apiProbe = await attacker.probe(`${ctx.targetUrl}/api/health`, { method: 'GET' });
    if (apiProbe.status === 200) {
      return this.createResult(
        'PASS',
        apiProbe.durationMs,
        `Health endpoint /api/health responded HTTP 200 in ${apiProbe.durationMs}ms.`,
        `Status: 200\nResponse Time: ${apiProbe.durationMs}ms`,
        ''
      );
    }

    return this.createResult(
      'FAIL',
      probe.durationMs,
      `Health endpoints /health and /api/health failed to respond with HTTP 200 (Got ${probe.status || 'timeout'}).`,
      `Status: ${probe.status}\nError: ${probe.bodyText}`,
      'Production failure: Missing or unhealthy liveness/readiness probe.'
    );
  }
}
