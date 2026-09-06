import { describe, it, expect, afterEach } from 'vitest';
import { DeployEngine } from '../engine/deploy-engine.js';
import { ProjectProfile } from '@preflight/core';
import {
  createTempCommittedEnvProject,
  createTempExposedSecretProject,
  TempProject
} from '@preflight/core';

describe('DeployEngine Readiness Checks (Dynamic Temporary Projects)', () => {
  const engine = new DeployEngine();
  let tempProj: TempProject | null = null;

  afterEach(() => {
    if (tempProj) {
      tempProj.cleanup();
      tempProj = null;
    }
  });

  it('should detect committed .env file defect (DEPLOY-ENV-004)', async () => {
    tempProj = createTempCommittedEnvProject();
    const profile: ProjectProfile = {
      name: 'committed-env',
      rootPath: tempProj.rootPath,
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
    tempProj = createTempExposedSecretProject();
    const profile: ProjectProfile = {
      name: 'exposed-secret',
      rootPath: tempProj.rootPath,
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
    expect(sec001?.evidence.stdout).not.toContain('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
    expect(sec001?.evidence.stdout).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });
});
