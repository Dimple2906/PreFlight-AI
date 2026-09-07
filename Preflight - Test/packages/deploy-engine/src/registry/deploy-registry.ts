import { ProjectProfile } from '@preflight/core';
import { DeployCheck } from './base-check.js';
import { DeployEnv001ExampleExists, DeployEnv004NotCommitted } from '../checks/environment/deploy-env-001.js';
import { DeployGit001GitignoreCheck } from '../checks/git/deploy-git-001.js';
import { DeployRuntime003LockfileCheck } from '../checks/runtime/deploy-runtime-003.js';
import { DeploySecrets001StaticSecretScan } from '../checks/secrets/deploy-secrets-001.js';
import { DeployBuild001ProductionBuild } from '../checks/build/deploy-build-001.js';
import { DeployDb001MigrationCheck, DeployHosting001ConfigCheck } from '../checks/database/deploy-db-001.js';

export class DeployRegistry {
  private checks: Map<string, DeployCheck> = new Map();

  constructor() {
    this.registerDefaultChecks();
  }

  public register(check: DeployCheck): void {
    this.checks.set(check.id, check);
  }

  public getApplicableChecks(profile: ProjectProfile): DeployCheck[] {
    const applicable: DeployCheck[] = [];
    for (const check of this.checks.values()) {
      if (check.isApplicable(profile)) {
        applicable.push(check);
      }
    }
    return applicable;
  }

  private registerDefaultChecks(): void {
    this.register(new DeployEnv001ExampleExists());
    this.register(new DeployEnv004NotCommitted());
    this.register(new DeployGit001GitignoreCheck());
    this.register(new DeployRuntime003LockfileCheck());
    this.register(new DeploySecrets001StaticSecretScan());
    this.register(new DeployBuild001ProductionBuild());
    this.register(new DeployDb001MigrationCheck());
    this.register(new DeployHosting001ConfigCheck());
  }
}
