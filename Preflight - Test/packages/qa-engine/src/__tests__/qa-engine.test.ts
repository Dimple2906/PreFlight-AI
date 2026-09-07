import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server } from 'node:http';
import { QAEngine } from '../engine/qa-engine.js';
import { QARegistry } from '../registry/qa-registry.js';
import { createVulnerableTestApp } from './vulnerable-app.js';
import { ProjectProfile } from '@preflight/core';

describe('Adversarial QA Engine Probing against Vulnerable App', () => {
  let server: Server;
  let targetUrl: string;

  beforeAll(async () => {
    server = createVulnerableTestApp();
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          targetUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('should detect real vulnerabilities deterministically in vulnerable app', async () => {
    const engine = new QAEngine();

    const sampleProfile: ProjectProfile = {
      name: 'vulnerable-shop',
      rootPath: process.cwd(),
      languages: ['javascript'],
      frameworks: ['express'],
      runtime: 'node',
      databases: ['none'],
      architecture: 'monolith',
      projectType: 'api-server',
      hosting: ['unknown'],
      packageManager: 'npm',
      hasDockerfile: false,
      hasCIConfig: false,
      entrypoints: [],
      testFrameworks: [],
      envFiles: [],
      dependencies: {},
      devDependencies: {},
      domainSignals: ['auth'],
      evidenceList: []
    };

    const results = await engine.executeAdversarialSuite(sampleProfile, targetUrl);

    // Verify AUTH-001 detected missing auth vulnerability
    const auth001 = results.find(r => r.targetId === 'AUTH-001');
    expect(auth001).toBeDefined();
    expect(auth001?.status).toBe('FAIL');
    expect(auth001?.findings.length).toBeGreaterThan(0);

    // Verify INPUT-003 detected negative quantity vulnerability
    const input003 = results.find(r => r.targetId === 'INPUT-003');
    expect(input003).toBeDefined();
    expect(input003?.status).toBe('FAIL');
    expect(input003?.severity).toBe('CRITICAL');

    // Verify SEC-001 detected stack trace leakage
    const sec001 = results.find(r => r.targetId === 'SEC-001');
    expect(sec001).toBeDefined();
    expect(sec001?.status).toBe('FAIL');
  });

  it('should resolve aliases and validate capabilities in QARegistry', () => {
    const registry = new QARegistry();

    // Alias resolution
    const authzTest = registry.findTest('authorization-boundary');
    expect(authzTest).toBeDefined();
    expect(authzTest?.id).toBe('AUTH-004');

    const rateTest = registry.findTest('rate-limit');
    expect(rateTest).toBeDefined();
    expect(rateTest?.id).toBe('RATE-001');

    const concTest = registry.findTest('concurrency');
    expect(concTest).toBeDefined();
    expect(concTest?.id).toBe('CONC-001');

    // Unknown capability validation
    const sampleProfile: ProjectProfile = {
      name: 'test',
      rootPath: process.cwd(),
      languages: ['typescript'],
      frameworks: ['express'],
      runtime: 'node',
      databases: [],
      architecture: 'monolith',
      projectType: 'api-server',
      hosting: [],
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

    const invalid = registry.validateRecommendation('arbitrary-shell-command', sampleProfile);
    expect(invalid.valid).toBe(false);
    expect(invalid.reason).toContain('No compatible deterministic executor');

    const valid = registry.validateRecommendation('qa-conc-requests', sampleProfile);
    expect(valid.valid).toBe(true);
    expect(valid.test?.id).toBe('CONC-001');
  });
});
