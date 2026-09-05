import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { DeployEngine } from '../engine/deploy-engine.js';
import { ProjectProfile } from '@preflight/core';

describe('DeployEngine Readiness Checks against Deployment Flaw Fixtures', () => {
  const engine = new DeployEngine();

  it('should detect committed .env file defect (DEPLOY-ENV-004)', async () => {
    const committedEnvRoot = path.resolve(process.cwd(), 'tests/fixtures/deployment-flaws/committed-env');
    const profile: ProjectProfile = {
      name: 'committed-env',
      rootPath: committedEnvRoot,
      languages: ['javascript'],
      frameworks: ['unknown'],
      runtime: 'node',
      databases: ['none'],
      architecture: 'monolith',
      projectType: 'web-app',
      hosting: ['unknown'],
      packageManager: 'npm',
      hasDockerfile: false,
      hasCIConfig: false,
      entrypoints: [],
      testFrameworks: [],
      envFiles: ['.env'],
      dependencies: {},
      devDependencies: {},
      domainSignals: [],
      evidenceList: []
    };

    const results = await engine.executeReadinessSuite(profile);
    const env004 = results.find(r => r.targetId === 'DEPLOY-ENV-004');

    expect(env004).toBeDefined();
    expect(env004?.status).toBe('FAIL');
    expect(env004?.severity).toBe('CRITICAL');
  });

  it('should detect hardcoded secret credentials (DEPLOY-SECRETS-001) with [REDACTED] value output', async () => {
    const exposedSecretRoot = path.resolve(process.cwd(), 'tests/fixtures/deployment-flaws/exposed-secret');
    const profile: ProjectProfile = {
      name: 'exposed-secret',
      rootPath: exposedSecretRoot,
      languages: ['typescript'],
      frameworks: ['unknown'],
      runtime: 'node',
      databases: ['none'],
      architecture: 'monolith',
      projectType: 'web-app',
      hosting: ['unknown'],
      packageManager: 'npm',
      hasDockerfile: false,
      hasCIConfig: false,
      entrypoints: [],
      testFrameworks: [],
      envFiles: [],
      dependencies: {},
      devDependencies: {},
      domainSignals: [],
      evidenceList: []
    };

    const results = await engine.executeReadinessSuite(profile);
    const sec001 = results.find(r => r.targetId === 'DEPLOY-SECRETS-001');

    expect(sec001).toBeDefined();
    expect(sec001?.status).toBe('FAIL');
    expect(sec001?.evidence.stdout).toContain('Value: [REDACTED]');
    expect(sec001?.evidence.stdout).not.toContain('sk-1234567890abcdef1234567890abcdef');
    expect(sec001?.evidence.stdout).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });
});
