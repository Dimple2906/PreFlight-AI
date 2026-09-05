import { AdversarialTest } from '../../registry/base-test.js';
import { QAExecutionContext } from '../../context/qa-context.js';
import { HttpAttacker } from '../../attacks/http-attacker.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class Sec001SensitiveErrorLeakage extends AdversarialTest {
  public readonly id = 'SEC-001';
  public readonly name = 'Sensitive Error & Stack Trace Leakage Probe';
  public readonly category = 'security';
  public readonly purpose = 'Verify HTTP error responses do not leak internal stack traces, DB queries, or file paths';
  public readonly severity = 'HIGH' as const;
  public readonly remediation = 'Catch all unhandled errors and return generic error messages in production environment.';

  public isApplicable(profile: ProjectProfile): boolean {
    return true;
  }

  public async execute(ctx: QAExecutionContext): Promise<ExecutionResult> {
    if (!ctx.targetUrl) {
      return this.createSkippedResult('No target URL provided.');
    }

    const attacker = new HttpAttacker(ctx.sanitizer);
    const probe = await attacker.probe(`${ctx.targetUrl}/api/data?trigger=error`, { method: 'GET' });

    const leakKeywords = ['at ', 'TypeError', 'ReferenceError', 'node_modules', 'SELECT ', 'mongo'];
    const hasLeak = leakKeywords.some(keyword => probe.bodyText.includes(keyword));

    if (hasLeak) {
      return this.createResult(
        'FAIL',
        probe.durationMs,
        'Sensitive stack trace or database error query leaked in HTTP error response.',
        `Status: ${probe.status}\nBody Snippet: ${probe.bodyText.slice(0, 200)}`,
        'Information exposure flaw.'
      );
    }

    return this.createResult(
      'PASS',
      probe.durationMs,
      'No stack trace or internal implementation leakage detected in error responses.',
      `Status: ${probe.status}`,
      ''
    );
  }
}
