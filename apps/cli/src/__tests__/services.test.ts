import { describe, it, expect, afterEach } from 'vitest';
import { TestAppService, DeployAppService, DoctorAppService } from '../services/index.js';
import { createTempVulnerableProject, TempProject } from '../../../../tests/utils/temp-projects.js';

describe('CLI Application Services (Dynamic Temporary Projects)', () => {
  let tempProj: TempProject | null = null;

  afterEach(() => {
    if (tempProj) {
      tempProj.cleanup();
      tempProj = null;
    }
  });

  it('should execute DoctorAppService diagnostics', async () => {
    const service = new DoctorAppService();
    const results = await service.run();
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0].check).toBe('Node.js Runtime');
    expect(results[0].passed).toBe(true);
  }, 15000);

  it('should run TestAppService on dynamic target project', async () => {
    tempProj = createTempVulnerableProject();
    const service = new TestAppService();
    const report = await service.run({
      projectPath: tempProj.rootPath,
      enableAi: false
    });

    expect(report.mode).toBe('test');
    expect(report.results.length).toBeGreaterThan(0);
    expect(report.overallStatus).toBeDefined();
  }, 15000);

  it('should run DeployAppService on dynamic target project', async () => {
    tempProj = createTempVulnerableProject();
    const service = new DeployAppService();
    const report = await service.run({
      projectPath: tempProj.rootPath,
      enableAi: false
    });

    expect(report.mode).toBe('deploy');
    expect(report.results.length).toBeGreaterThan(0);
  }, 15000);
});
