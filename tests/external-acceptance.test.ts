import { describe, it, expect, afterEach } from 'vitest';
import * as path from 'node:path';
import { PreflightTestService } from '../apps/cli/src/services/test.service.js';
import { PreflightDeployService } from '../apps/cli/src/services/deploy.service.js';
import { ProjectInspector } from '../packages/discovery/src/index.js';
import { ProjectClassifier } from '../packages/classifier/src/index.js';
import { ReportEngine } from '../packages/reporter/src/index.js';
import {
  createTempNodeProject,
  createTempPythonProject,
  createTempSpringProject,
  createTempStaticProject,
  TempProject
} from './utils/temp-projects.js';

describe('External Project Acceptance & Self-Dogfooding', () => {
  let tempProjs: TempProject[] = [];

  afterEach(() => {
    for (const p of tempProjs) {
      p.cleanup();
    }
    tempProjs = [];
  });

  it('verifies PreFlight works against completely new external project outside repo', async () => {
    const proj = createTempNodeProject();
    tempProjs.push(proj);

    const testService = new PreflightTestService();
    const report = await testService.run({
      projectPath: proj.rootPath,
      enableAi: true
    });

    expect(report.mode).toBe('test');
    expect(report.projectProfile.rootPath).toBe(path.resolve(proj.rootPath));
    expect(report.results.length).toBeGreaterThanOrEqual(2);

    // Verify structured evidence
    for (const res of report.results) {
      expect(res.evidence).toBeDefined();
      expect(typeof res.durationMs).toBe('number');
    }

    // Verify reporter outputs
    const reporter = new ReportEngine();
    const jsonStr = reporter.renderJson(report);
    const jsonParsed = JSON.parse(jsonStr);

    expect(jsonParsed.version).toBe('1.0');
    expect(jsonParsed.project.name).toBe('temp-node-api');
    expect(jsonParsed.verdict.passed).toBe(true);
  }, 30000);

  it('verifies dynamic discovery and classification across Python and Spring Boot projects', async () => {
    const pyProj = createTempPythonProject();
    const springProj = createTempSpringProject();
    tempProjs.push(pyProj, springProj);

    const inspector = new ProjectInspector();
    const classifier = new ProjectClassifier();

    const pyDiscovered = await inspector.inspect(pyProj.rootPath);
    const pyProfile = classifier.classify(pyDiscovered);
    expect(pyProfile.frameworks).toContain('fastapi');
    expect(pyProfile.runtime).toBe('python');

    const springDiscovered = await inspector.inspect(springProj.rootPath);
    const springProfile = classifier.classify(springDiscovered);
    expect(springProfile.frameworks).toContain('spring');
    expect(springProfile.languages).toContain('java');
  }, 30000);

  it('verifies self-dogfooding: PreFlight evaluates itself without special-casing', async () => {
    const repoRoot = path.resolve(process.cwd());
    const inspector = new ProjectInspector();
    const classifier = new ProjectClassifier();

    const discovered = await inspector.inspect(repoRoot);
    const profile = classifier.classify(discovered);

    expect(profile.name).toBe('preflight-monorepo');
    expect(profile.runtime).toBe('node');
    expect(profile.languages).toContain('typescript');

    const deployService = new PreflightDeployService();
    const deployReport = await deployService.run({
      projectPath: repoRoot,
      enableAi: false
    });

    expect(deployReport.mode).toBe('deploy');
    expect(deployReport.stats.total).toBeGreaterThan(0);
  }, 45000);
});
