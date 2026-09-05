import { ExecutionResult } from '@preflight/core';
import { DeployCheck } from '../registry/base-check.js';
import { DeployExecutionContext } from '../context/deploy-context.js';

export class DeployRunner {
  public async runChecks(
    checks: DeployCheck[],
    ctx: DeployExecutionContext
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    for (const check of checks) {
      const res = await check.execute(ctx);
      results.push(res);
    }
    return results;
  }
}
