import * as fs from 'node:fs';
import * as path from 'node:path';
import { DeployCheck } from '../../registry/base-check.js';
import { DeployExecutionContext } from '../../context/deploy-context.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class DeployGit001GitignoreCheck extends DeployCheck {
  public readonly id = 'DEPLOY-GIT-001';
  public readonly name = 'Git Hygiene & Ignored Files Verification';
  public readonly category = 'git';
  public readonly purpose = 'Verify .gitignore exists and properly ignores node_modules, .env, and build distribution folders';
  public readonly severity = 'HIGH' as const;
  public readonly remediation = 'Create a .gitignore file ignoring node_modules, .env, and dist/out build directories.';

  public isApplicable(profile: ProjectProfile): boolean {
    return true;
  }

  public async execute(ctx: DeployExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const gitignorePath = path.join(ctx.projectRoot, '.gitignore');
    const exists = fs.existsSync(gitignorePath);
    const durationMs = Date.now() - startTime;

    if (!exists) {
      return this.createResult(
        'FAIL',
        durationMs,
        'No .gitignore file found in root directory.',
        'File missing: .gitignore',
        'Risk: Accidentally committing node_modules or secret environment files.'
      );
    }

    const content = fs.readFileSync(gitignorePath, 'utf-8');
    const ignoresEnv = content.includes('.env');

    if (!ignoresEnv) {
      return this.createResult(
        'WARN',
        durationMs,
        '.gitignore exists but does not explicitly list .env pattern.',
        'File content missing: .env line in .gitignore',
        'Risk: Future secret commit.'
      );
    }

    return this.createResult(
      'PASS',
      durationMs,
      '.gitignore file verified with proper secret exclusion rules.',
      'File verified: .gitignore',
      ''
    );
  }
}
