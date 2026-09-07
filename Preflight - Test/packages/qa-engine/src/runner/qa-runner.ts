import { ExecutionResult } from '@preflight/core';
import { AdversarialTest } from '../registry/base-test.js';
import { QAExecutionContext } from '../context/qa-context.js';

export class QARunner {
  public async runTests(
    tests: AdversarialTest[],
    ctx: QAExecutionContext
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const concurrency = Math.max(1, Math.min(ctx.maxConcurrency || 4, 10));

    // Controlled batch execution
    for (let i = 0; i < tests.length; i += concurrency) {
      const batch = tests.slice(i, i + concurrency);
      const batchPromises = batch.map(test => test.execute(ctx));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }
}
