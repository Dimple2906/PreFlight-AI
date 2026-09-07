import { AdversarialTest } from '../../registry/base-test.js';
import { QAExecutionContext } from '../../context/qa-context.js';
import { HttpAttacker } from '../../attacks/http-attacker.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class Rate001RateLimitProbe extends AdversarialTest {
  public readonly id = 'RATE-001';
  public readonly name = 'Rate Limit & Burst Throttling Probe';
  public readonly category = 'rate-limit' as any;
  public readonly purpose = 'Verify rapid burst requests are throttled with HTTP 429 Too Many Requests';
  public readonly severity = 'MEDIUM' as const;
  public readonly remediation = 'Attach rate limiting middleware (e.g., express-rate-limit) to public API endpoints.';

  public isApplicable(profile: ProjectProfile): boolean {
    return profile.projectType === 'fullstack' || profile.projectType === 'web-app';
  }

  public async execute(ctx: QAExecutionContext): Promise<ExecutionResult> {
    if (!ctx.targetUrl) {
      return this.createSkippedResult('No target URL provided for active rate-limiting probing.');
    }

    const attacker = new HttpAttacker(ctx.sanitizer);
    const results = await attacker.probeConcurrent(`${ctx.targetUrl}/api/health`, 20);
    const throttled = results.some((r) => r.status === 429);

    if (throttled) {
      return this.createResult(
        'PASS',
        results.reduce((acc: number, r) => acc + r.durationMs, 0),
        'Rate limiting active: rapid burst requests received HTTP 429 Too Many Requests.',
        `Throttling observed across 20 burst requests.`,
        ''
      );
    }

    return this.createResult(
      'WARN' as any,
      results.reduce((acc: number, r) => acc + r.durationMs, 0),
      'No rate limiting detected: 20 rapid burst requests were all processed without 429 response.',
      `Burst responses: all HTTP 200/OK.`,
      'Missing rate limiting increases exposure to denial-of-service and brute-force attacks.'
    );
  }
}
