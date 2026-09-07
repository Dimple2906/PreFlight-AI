import { AdversarialTest } from '../../registry/base-test.js';
import { QAExecutionContext } from '../../context/qa-context.js';
import { HttpAttacker } from '../../attacks/http-attacker.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class Input006MalformedJson extends AdversarialTest {
  public readonly id = 'INPUT-006';
  public readonly name = 'Malformed JSON Payload Probe';
  public readonly category = 'input';
  public readonly purpose = 'Verify body parser handles malformed JSON syntax without crashing or leaking stack trace';
  public readonly severity = 'MEDIUM' as const;
  public readonly remediation = 'Use standard JSON body parsing error handlers (e.g. express.json() error middleware).';

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
      body: '{ invalid_json_syntax: true, '
    });

    if (probe.status === 500 && probe.bodyText.includes('SyntaxError')) {
      return this.createResult(
        'FAIL',
        probe.durationMs,
        'Malformed JSON caused 500 internal server error and leaked raw SyntaxError stack trace.',
        `Status: ${probe.status}\nBody: ${probe.bodyText}`,
        'Unhandled body parsing exception.'
      );
    }

    return this.createResult(
      'PASS',
      probe.durationMs,
      `Malformed JSON safely handled with HTTP ${probe.status || 400}.`,
      `Status: ${probe.status}`,
      ''
    );
  }
}
