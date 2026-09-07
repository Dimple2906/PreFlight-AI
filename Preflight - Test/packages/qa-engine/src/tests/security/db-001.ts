import { AdversarialTest } from '../../registry/base-test.js';
import { QAExecutionContext } from '../../context/qa-context.js';
import { HttpAttacker } from '../../attacks/http-attacker.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class Db001DatabaseIntegrityProbe extends AdversarialTest {
  public readonly id = 'DB-001';
  public readonly name = 'Database Integrity & SQL Boundary Injection Probe';
  public readonly category = 'security' as any;
  public readonly purpose = 'Verify database query interfaces reject unescaped SQL meta-characters and injection payloads';
  public readonly severity = 'CRITICAL' as const;
  public readonly remediation = 'Use parameterized queries, ORM query builders, or prepared statements.';

  public isApplicable(profile: ProjectProfile): boolean {
    return profile.databases?.length > 0 || profile.domainSignals?.includes('databases');
  }

  public async execute(ctx: QAExecutionContext): Promise<ExecutionResult> {
    if (!ctx.targetUrl) {
      return this.createSkippedResult('No target URL provided for active SQL boundary probing.');
    }

    const attacker = new HttpAttacker(ctx.sanitizer);
    const probe = await attacker.probe(`${ctx.targetUrl}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: "' OR 1=1 --", id: "1; DROP TABLE users;--" })
    });

    const bodyLower = (probe.bodyText || '').toLowerCase();
    const hasSqlError = bodyLower.includes('syntax error') || bodyLower.includes('sql') || bodyLower.includes('pg_query');

    if (hasSqlError) {
      return this.createResult(
        'FAIL',
        probe.durationMs,
        'Database error leaked in response: SQL injection boundary failure detected.',
        `Status: ${probe.status}\nBody: ${probe.bodyText}`,
        'Critical vulnerability: Potential SQL injection / database error leakage.'
      );
    }

    return this.createResult(
      'PASS',
      probe.durationMs,
      'SQL injection probe handled safely without database syntax errors or leakages.',
      `Status: ${probe.status}`,
      ''
    );
  }
}
