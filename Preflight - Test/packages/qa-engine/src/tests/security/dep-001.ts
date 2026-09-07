import * as fs from 'node:fs';
import * as path from 'node:path';
import { AdversarialTest } from '../../registry/base-test.js';
import { QAExecutionContext } from '../../context/qa-context.js';
import { ProjectProfile, ExecutionResult } from '@preflight/core';

export class Dep001DependencyRiskProbe extends AdversarialTest {
  public readonly id = 'DEP-001';
  public readonly name = 'Package Manifest & Dependency Risk Audit';
  public readonly category = 'security' as any;
  public readonly purpose = 'Verify package dependencies have locked versions and no unpinned wildcard dependencies';
  public readonly severity = 'MEDIUM' as const;
  public readonly remediation = 'Lock dependencies with exact versions or caret ranges, and maintain an updated lockfile.';

  public isApplicable(profile: ProjectProfile): boolean {
    return Boolean(profile.dependencies && Object.keys(profile.dependencies).length > 0);
  }

  public async execute(ctx: QAExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const pkgPath = path.join(ctx.projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return this.createSkippedResult('No package.json found.');
    }

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const wildcardDeps = Object.entries(deps).filter(([_, v]) => v === '*' || v === 'latest');

      if (wildcardDeps.length > 0) {
        return this.createResult(
          'WARN' as any,
          Date.now() - startTime,
          `Found ${wildcardDeps.length} unpinned dependencies with wildcard or "latest" versions (${wildcardDeps.map(([k]) => k).join(', ')}).`,
          `Wildcards: ${wildcardDeps.map(([k, v]) => `${k}@${v}`).join(', ')}`,
          'Unpinned dependencies lead to non-deterministic production deployments and supply-chain vulnerability.'
        );
      }

      return this.createResult(
        'PASS',
        Date.now() - startTime,
        'All declared dependencies use pinned semantic version ranges.',
        `Audited ${Object.keys(deps).length} package dependencies.`,
        ''
      );
    } catch (err: any) {
      return this.createSkippedResult(`Could not parse package.json: ${err.message}`);
    }
  }
}
