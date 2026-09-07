import * as fs from 'node:fs';
import * as path from 'node:path';
import { DeployCheck } from '../../registry/base-check.js';
import { DeployExecutionContext } from '../../context/deploy-context.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class DeployEnv001ExampleExists extends DeployCheck {
  public readonly id = 'DEPLOY-ENV-001';
  public readonly name = 'Environment Template Documentation Check';
  public readonly category = 'environment';
  public readonly purpose = 'Verify .env.example or .env.sample template exists for deployment environment variable documentation';
  public readonly severity = 'HIGH' as const;
  public readonly remediation = 'Create a sanitized .env.example file documenting all required environment variables.';

  public isApplicable(profile: ProjectProfile): boolean {
    return true;
  }

  public async execute(ctx: DeployExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const exampleExists = fs.existsSync(path.join(ctx.projectRoot, '.env.example')) ||
                          fs.existsSync(path.join(ctx.projectRoot, '.env.sample'));

    const durationMs = Date.now() - startTime;

    if (!exampleExists) {
      return this.createResult(
        'FAIL',
        durationMs,
        'No .env.example or .env.sample file found in project root.',
        'File missing: .env.example',
        'Environment variables are not documented.'
      );
    }

    return this.createResult(
      'PASS',
      durationMs,
      'Environment template file (.env.example) present.',
      'File found: .env.example',
      ''
    );
  }
}

export class DeployEnv004NotCommitted extends DeployCheck {
  public readonly id = 'DEPLOY-ENV-004';
  public readonly name = 'Committed Secret Environment File Prevention';
  public readonly category = 'environment';
  public readonly purpose = 'Verify actual .env files containing real secret values are not committed or present in build workspace';
  public readonly severity = 'CRITICAL' as const;
  public readonly remediation = 'Add .env to .gitignore and remove sensitive environment files from source control.';

  public isApplicable(profile: ProjectProfile): boolean {
    return true;
  }

  public async execute(ctx: DeployExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const envPath = path.join(ctx.projectRoot, '.env');
    const envExists = fs.existsSync(envPath);
    const durationMs = Date.now() - startTime;

    if (envExists) {
      return this.createResult(
        'FAIL',
        durationMs,
        'Found active .env file present in root directory. Ensure secrets are supplied via environment variables, not committed files.',
        'File present: .env',
        'Risk: Secret leakage into build environment.'
      );
    }

    return this.createResult(
      'PASS',
      durationMs,
      'No .env file found in root workspace.',
      'File absent: .env',
      ''
    );
  }
}
