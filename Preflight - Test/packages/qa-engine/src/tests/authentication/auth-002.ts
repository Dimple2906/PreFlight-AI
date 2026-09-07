import { AdversarialTest } from '../../registry/base-test.js';
import { QAExecutionContext } from '../../context/qa-context.js';
import { HttpAttacker } from '../../attacks/http-attacker.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class Auth002InvalidCredentials extends AdversarialTest {
  public readonly id = 'AUTH-002';
  public readonly name = 'Invalid Credentials Probe';
  public readonly category = 'authentication';
  public readonly purpose = 'Verify endpoint rejects malformed or invalid Bearer tokens';
  public readonly severity = 'HIGH' as const;
  public readonly remediation = 'Validate token signatures and reject invalid tokens with HTTP 401.';

  public isApplicable(profile: ProjectProfile): boolean {
    return true;
  }

  public async execute(ctx: QAExecutionContext): Promise<ExecutionResult> {
    if (!ctx.targetUrl) {
      return this.createSkippedResult('No target URL provided for active HTTP probing.');
    }

    const attacker = new HttpAttacker(ctx.sanitizer);
    const probe = await attacker.probe(`${ctx.targetUrl}/api/user/profile`, {
      method: 'GET',
      headers: { Authorization: 'Bearer invalid_bogus_token_123' }
    });

    if (probe.status === 200) {
      return this.createResult(
        'FAIL',
        probe.durationMs,
        'Endpoint accepted invalid Bearer token and returned HTTP 200 OK.',
        `Status: ${probe.status}\nBody: ${probe.bodyText}`,
        'Security flaw: Invalid token accepted.'
      );
    }

    return this.createResult(
      'PASS',
      probe.durationMs,
      `Invalid Bearer token correctly rejected with HTTP ${probe.status}.`,
      `Status: ${probe.status}\nBody: ${probe.bodyText}`,
      ''
    );
  }
}
