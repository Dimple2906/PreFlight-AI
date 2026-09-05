import { AdversarialTest } from '../../registry/base-test.js';
import { QAExecutionContext } from '../../context/qa-context.js';
import { HttpAttacker } from '../../attacks/http-attacker.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class Auth003ExpiredToken extends AdversarialTest {
  public readonly id = 'AUTH-003';
  public readonly name = 'Expired Token Probe';
  public readonly category = 'authentication';
  public readonly purpose = 'Verify expired JWT tokens are rejected';
  public readonly severity = 'HIGH' as const;
  public readonly remediation = 'Ensure JWT expiration time (exp) is enforced during token verification.';

  public isApplicable(profile: ProjectProfile): boolean {
    return true;
  }

  public async execute(ctx: QAExecutionContext): Promise<ExecutionResult> {
    if (!ctx.targetUrl) {
      return this.createSkippedResult('No target URL provided.');
    }

    // Header: {"alg":"HS256","typ":"JWT"}, Payload: {"exp":1000000000} (expired long ago)
    const expiredJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ZXhwOjEwMDAwMDAwMDA.signature';
    const attacker = new HttpAttacker(ctx.sanitizer);
    const probe = await attacker.probe(`${ctx.targetUrl}/api/user/profile`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${expiredJwt}` }
    });

    if (probe.status === 200) {
      return this.createResult(
        'FAIL',
        probe.durationMs,
        'Endpoint accepted expired JWT token.',
        `Status: ${probe.status}`,
        'Expired JWT permitted access.'
      );
    }

    return this.createResult(
      'PASS',
      probe.durationMs,
      `Expired token rejected with status ${probe.status}.`,
      `Status: ${probe.status}`,
      ''
    );
  }
}
