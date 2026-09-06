import { AdversarialTest } from '../../registry/base-test.js';
import { QAExecutionContext } from '../../context/qa-context.js';
import { HttpAttacker } from '../../attacks/http-attacker.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class Auth004AuthorizationBoundary extends AdversarialTest {
  public readonly id = 'AUTH-004';
  public readonly name = 'Authorization Boundary & Resource Ownership Probe';
  public readonly category = 'authorization' as any;
  public readonly purpose = 'Verify multi-tenant and role-based endpoints reject unauthorized cross-tenant or unprivileged requests with 403 Forbidden';
  public readonly severity = 'HIGH' as const;
  public readonly remediation = 'Implement strict resource-level authorization checks before returning tenant-isolated data.';

  public isApplicable(profile: ProjectProfile): boolean {
    return profile.domainSignals?.includes('auth') || profile.projectType === 'fullstack' || profile.projectType === 'web-app';
  }

  public async execute(ctx: QAExecutionContext): Promise<ExecutionResult> {
    if (!ctx.targetUrl) {
      return this.createSkippedResult('No target URL provided for active HTTP authorization probing.');
    }

    const attacker = new HttpAttacker(ctx.sanitizer);
    const probe = await attacker.probe(`${ctx.targetUrl}/api/admin/users`, {
      method: 'GET',
      headers: { Authorization: 'Bearer mock-user-role-token' }
    });

    if (probe.status === 200) {
      return this.createResult(
        'FAIL',
        probe.durationMs,
        'Admin endpoint /api/admin/users responded with HTTP 200 OK to unprivileged user role token.',
        `Status: ${probe.status}\nBody: ${probe.bodyText}`,
        'Authorization vulnerability: Missing role-based access control.'
      );
    }

    return this.createResult(
      'PASS',
      probe.durationMs,
      `Cross-role access correctly rejected with HTTP ${probe.status || 403}.`,
      `Status: ${probe.status}\nBody: ${probe.bodyText}`,
      ''
    );
  }
}
