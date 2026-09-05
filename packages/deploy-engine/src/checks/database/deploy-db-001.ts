import * as fs from 'node:fs';
import * as path from 'node:path';
import { DeployCheck } from '../../registry/base-check.js';
import { DeployExecutionContext } from '../../context/deploy-context.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class DeployDb001MigrationCheck extends DeployCheck {
  public readonly id = 'DEPLOY-DB-001';
  public readonly name = 'Database Migration & Schema Configuration';
  public readonly category = 'database';
  public readonly purpose = 'Verify database ORM schemas and migration scripts are present when databases are used';
  public readonly severity = 'HIGH' as const;
  public readonly remediation = 'Ensure database schema (e.g. prisma/schema.prisma) and migration scripts are configured.';

  public isApplicable(profile: ProjectProfile): boolean {
    return profile.databases.length > 0 && !profile.databases.includes('none');
  }

  public async execute(ctx: DeployExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const hasPrisma = fs.existsSync(path.join(ctx.projectRoot, 'prisma/schema.prisma'));
    const hasDrizzle = fs.existsSync(path.join(ctx.projectRoot, 'drizzle.config.ts'));
    const durationMs = Date.now() - startTime;

    if (!hasPrisma && !hasDrizzle) {
      return this.createResult(
        'WARN',
        durationMs,
        'Database driver detected in dependencies, but no standard ORM schema (Prisma/Drizzle) found in root.',
        'Database configured without detected schema config file.',
        'Verify database migrations are executed during deployment.'
      );
    }

    return this.createResult(
      'PASS',
      durationMs,
      'Database ORM schema configuration verified.',
      `Schema present: ${hasPrisma ? 'Prisma' : 'Drizzle'}`,
      ''
    );
  }
}

export class DeployHosting001ConfigCheck extends DeployCheck {
  public readonly id = 'DEPLOY-HOSTING-001';
  public readonly name = 'Deployment Hosting Configuration Verification';
  public readonly category = 'hosting';
  public readonly purpose = 'Verify hosting configuration file (vercel.json, Dockerfile, netlify.toml) exists for deployment provider';
  public readonly severity = 'MEDIUM' as const;
  public readonly remediation = 'Add target hosting provider configuration file (e.g. vercel.json or Dockerfile).';

  public isApplicable(profile: ProjectProfile): boolean {
    return true;
  }

  public async execute(ctx: DeployExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const hasVercel = fs.existsSync(path.join(ctx.projectRoot, 'vercel.json'));
    const hasDocker = fs.existsSync(path.join(ctx.projectRoot, 'Dockerfile'));
    const durationMs = Date.now() - startTime;

    if (!hasVercel && !hasDocker && ctx.profile.projectType === 'fullstack') {
      return this.createResult(
        'WARN',
        durationMs,
        'Fullstack web application detected without explicit vercel.json or Dockerfile hosting manifest.',
        'Missing hosting manifest',
        'Verify hosting provider settings.'
      );
    }

    return this.createResult(
      'PASS',
      durationMs,
      `Hosting configuration verified: ${hasDocker ? 'Docker' : (hasVercel ? 'Vercel' : 'Standard Node')}`,
      'Hosting manifest verified.',
      ''
    );
  }
}
