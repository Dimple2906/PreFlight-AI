import { AdversarialTest } from '../../registry/base-test.js';
import { QAExecutionContext } from '../../context/qa-context.js';
import { HttpAttacker } from '../../attacks/http-attacker.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class Input001EmptyInput extends AdversarialTest {
  public readonly id = 'INPUT-001';
  public readonly name = 'Empty Input Payload Probe';
  public readonly category = 'input';
  public readonly purpose = 'Verify API endpoints validate request body presence and reject empty submissions';
  public readonly severity = 'MEDIUM' as const;
  public readonly remediation = 'Implement request body validation using Zod or Joi schemas.';

  public isApplicable(profile: ProjectProfile): boolean {
    return true;
  }

  public async execute(ctx: QAExecutionContext): Promise<ExecutionResult> {
    if (!ctx.targetUrl) {
      return this.createSkippedResult('No target URL provided.');
    }

    const attacker = new HttpAttacker(ctx.sanitizer);
    const probe = await attacker.probe(`${ctx.targetUrl}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });

    if (probe.status === 200) {
      return this.createResult(
        'FAIL',
        probe.durationMs,
        'API endpoint accepted empty payload {} with HTTP 200 OK.',
        `Status: ${probe.status}\nBody: ${probe.bodyText}`,
        'Weak input validation: empty payload processed successfully.'
      );
    }

    return this.createResult(
      'PASS',
      probe.durationMs,
      `Empty input correctly rejected with HTTP ${probe.status}.`,
      `Status: ${probe.status}`,
      ''
    );
  }
}

export class Input003NegativeValue extends AdversarialTest {
  public readonly id = 'INPUT-003';
  public readonly name = 'Negative Numerical Input Probe';
  public readonly category = 'input';
  public readonly purpose = 'Verify checkout/payment endpoints reject negative quantity or price values';
  public readonly severity = 'CRITICAL' as const;
  public readonly remediation = 'Enforce strictly positive integer checks (.positive()) on quantity and amount fields.';

  public isApplicable(profile: ProjectProfile): boolean {
    return true;
  }

  public async execute(ctx: QAExecutionContext): Promise<ExecutionResult> {
    if (!ctx.targetUrl) {
      return this.createSkippedResult('No target URL provided.');
    }

    const attacker = new HttpAttacker(ctx.sanitizer);
    const probe = await attacker.probe(`${ctx.targetUrl}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'item-100', quantity: -5, price: 50 })
    });

    if (probe.status === 200) {
      return this.createResult(
        'FAIL',
        probe.durationMs,
        'Checkout endpoint processed negative quantity (-5) and returned HTTP 200 OK.',
        `Status: ${probe.status}\nBody: ${probe.bodyText}`,
        'Critical financial logic flaw: negative quantity allowed.'
      );
    }

    return this.createResult(
      'PASS',
      probe.durationMs,
      `Negative numerical input rejected with HTTP ${probe.status}.`,
      `Status: ${probe.status}`,
      ''
    );
  }
}
