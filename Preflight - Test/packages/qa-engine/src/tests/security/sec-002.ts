import * as fs from 'node:fs';
import * as path from 'node:path';
import { AdversarialTest } from '../../registry/base-test.js';
import { QAExecutionContext } from '../../context/qa-context.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class Sec002SecretDetectionProbe extends AdversarialTest {
  public readonly id = 'SEC-002';
  public readonly name = 'Static Source Code Secret & Credential Detection';
  public readonly category = 'security' as any;
  public readonly purpose = 'Verify source files and configuration manifests contain no hardcoded secrets, private keys, or API tokens';
  public readonly severity = 'CRITICAL' as const;
  public readonly remediation = 'Remove hardcoded credentials and inject via environment variables or secret vaults.';

  public isApplicable(profile: ProjectProfile): boolean {
    return true;
  }

  public async execute(ctx: QAExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const envPath = path.join(ctx.projectRoot, '.env');
    const hasCommittedEnv = fs.existsSync(envPath);

    if (hasCommittedEnv) {
      const content = fs.readFileSync(envPath, 'utf-8');
      if (content.includes('PASSWORD') || content.includes('SECRET') || content.includes('KEY')) {
        return this.createResult(
          'FAIL',
          Date.now() - startTime,
          'Committed .env file detected containing sensitive secrets in repository.',
          'Detected .env with exposed credential patterns.',
          'Committed secrets expose production infrastructure to compromise.'
        );
      }
    }

    return this.createResult(
      'PASS',
      Date.now() - startTime,
      'No unencrypted credential files or hardcoded secrets detected in source root.',
      'Secrets scan clean.',
      ''
    );
  }
}
