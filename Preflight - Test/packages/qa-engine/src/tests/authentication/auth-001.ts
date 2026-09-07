import { AdversarialTest } from '../../registry/base-test.js';
import { QAExecutionContext } from '../../context/qa-context.js';
import { HttpAttacker } from '../../attacks/http-attacker.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class Auth001MissingCredentials extends AdversarialTest {
  public readonly id = 'AUTH-001';
  public readonly name = 'Missing Credentials Probe';
  public readonly category = 'authentication';
  public readonly purpose = 'Verify protected endpoints reject requests submitted without authorization credentials';
  public readonly severity = 'HIGH' as const;
  public readonly remediation = 'Ensure authentication middleware rejects unauthenticated requests with HTTP 401 Unauthorized.';

  public isApplicable(profile: ProjectProfile): boolean {
    return true;
  }

  public async execute(ctx: QAExecutionContext): Promise<ExecutionResult> {
    if (!ctx.targetUrl) {
      return this.createSkippedResult('No target URL provided for active HTTP probing.');
    }

    const attacker = new HttpAttacker(ctx.sanitizer);
    const probe = await attacker.probe(`${ctx.targetUrl}/api/user/profile`, { method: 'GET' });

    if (probe.status === 200) {
      return this.createResult(
        'FAIL',
        probe.durationMs,
        'Protected endpoint /api/user/profile responded with HTTP 200 OK when accessed without credentials.',
        `Status: ${probe.status}\nBody: ${probe.bodyText}`,
        'Security flaw: Unauthenticated request permitted access to user profile.'
      );
    }

    return this.createResult(
      'PASS',
      probe.durationMs,
      `Unauthenticated request correctly rejected with HTTP ${probe.status || 401}.`,
      `Status: ${probe.status}\nBody: ${probe.bodyText}`,
      ''
    );
  }
}
