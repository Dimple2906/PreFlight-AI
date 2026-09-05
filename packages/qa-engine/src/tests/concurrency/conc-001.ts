import { AdversarialTest } from '../../registry/base-test.js';
import { QAExecutionContext } from '../../context/qa-context.js';
import { HttpAttacker } from '../../attacks/http-attacker.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class Conc001ConcurrentRequests extends AdversarialTest {
  public readonly id = 'CONC-001';
  public readonly name = 'Concurrent Request Burst Probe';
  public readonly category = 'concurrency';
  public readonly purpose = 'Verify transactional integrity under 20 simultaneous burst requests';
  public readonly severity = 'CRITICAL' as const;
  public readonly remediation = 'Implement atomic transactions and idempotency keys to prevent duplicate checkout creations.';

  public isApplicable(profile: ProjectProfile): boolean {
    return true;
  }

  public async execute(ctx: QAExecutionContext): Promise<ExecutionResult> {
    if (!ctx.targetUrl) {
      return this.createSkippedResult('No target URL provided.');
    }

    const attacker = new HttpAttacker(ctx.sanitizer);
    const count = 20;
    const probes = await attacker.probeConcurrent(`${ctx.targetUrl}/api/checkout`, count, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': 'key-burst-100' },
      body: JSON.stringify({ itemId: 'item-999', quantity: 1 })
    });

    const successCount = probes.filter(p => p.status === 200 || p.status === 201).length;
    const totalDuration = probes.reduce((acc, p) => acc + p.durationMs, 0) / count;

    if (successCount > 1) {
      return this.createResult(
        'FAIL',
        totalDuration,
        `Concurrency race condition detected: ${count} parallel requests with identical Idempotency-Key resulted in ${successCount} successful checkout transactions.`,
        `Requests: ${count}, Successes: ${successCount}`,
        'Atomic transaction protection missing.'
      );
    }

    return this.createResult(
      'PASS',
      totalDuration,
      `Concurrency test passed. ${count} requests resulted in ${successCount} successful transaction.`,
      `Requests: ${count}, Successes: ${successCount}`,
      ''
    );
  }
}
