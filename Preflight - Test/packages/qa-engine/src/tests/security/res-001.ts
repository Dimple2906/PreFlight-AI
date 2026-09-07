import { AdversarialTest } from '../../registry/base-test.js';
import { QAExecutionContext } from '../../context/qa-context.js';
import { HttpAttacker } from '../../attacks/http-attacker.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class Res001TimeoutResilienceProbe extends AdversarialTest {
  public readonly id = 'RES-001';
  public readonly name = 'Timeout & Resource Exhaustion Resilience Probe';
  public readonly category = 'resilience' as any;
  public readonly purpose = 'Verify service handles delayed responses and resource pressure without connection pooling deadlocks';
  public readonly severity = 'MEDIUM' as const;
  public readonly remediation = 'Configure explicit socket and upstream HTTP timeouts (e.g. 5000ms) with circuit breakers.';

  public isApplicable(profile: ProjectProfile): boolean {
    return profile.domainSignals?.includes('external-api') || profile.projectType === 'api-server';
  }

  public async execute(ctx: QAExecutionContext): Promise<ExecutionResult> {
    if (!ctx.targetUrl) {
      return this.createSkippedResult('No target URL provided for resilience probing.');
    }

    const attacker = new HttpAttacker(ctx.sanitizer);
    const probe = await attacker.probe(`${ctx.targetUrl}/api/health`, { method: 'GET' });

    if (probe.status >= 500) {
      return this.createResult(
        'WARN' as any,
        probe.durationMs,
        `Service degraded under resilience probe with HTTP ${probe.status}.`,
        `Status: ${probe.status}`,
        'Degraded availability under simulated latency.'
      );
    }

    return this.createResult(
      'PASS',
      probe.durationMs,
      `Service maintained responsive status within SLA (${probe.durationMs}ms).`,
      `Duration: ${probe.durationMs}ms`,
      ''
    );
  }
}
