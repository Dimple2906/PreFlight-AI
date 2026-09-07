import * as fs from 'node:fs';
import * as path from 'node:path';
import { DeployCheck } from '../../registry/base-check.js';
import { DeployExecutionContext } from '../../context/deploy-context.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class DeployRuntime003LockfileCheck extends DeployCheck {
  public readonly id = 'DEPLOY-RUNTIME-003';
  public readonly name = 'Package Manager Lockfile Verification';
  public readonly category = 'runtime';
  public readonly purpose = 'Verify a package manager lockfile (pnpm-lock.yaml, package-lock.json, yarn.lock) exists to guarantee deterministic production builds';
  public readonly severity = 'CRITICAL' as const;
  public readonly remediation = 'Generate and commit a package manager lockfile by running pnpm install or npm install.';

  public isApplicable(profile: ProjectProfile): boolean {
    return true;
  }

  public async execute(ctx: DeployExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const lockfiles = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb'];
    const found = lockfiles.find(f => fs.existsSync(path.join(ctx.projectRoot, f)));
    const durationMs = Date.now() - startTime;

    if (!found) {
      return this.createResult(
        'FAIL',
        durationMs,
        'No package manager lockfile found (pnpm-lock.yaml, package-lock.json, or yarn.lock).',
        'Missing lockfile',
        'Risk: Non-deterministic production builds due to floating dependency updates.'
      );
    }

    return this.createResult(
      'PASS',
      durationMs,
      `Deterministic lockfile found: ${found}`,
      `Lockfile present: ${found}`,
      ''
    );
  }
}
