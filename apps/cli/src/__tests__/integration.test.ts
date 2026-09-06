import { describe, it, expect, afterEach } from 'vitest';
import { PreflightTestService } from '../services/test.service.js';
import { PreflightDeployService } from '../services/deploy.service.js';
import { ReportEngine } from '@preflight/reporter';
import {
  createTempBrokenDeploymentProject,
  createTempNodeProject,
  TempProject
} from '../../../../tests/utils/temp-projects.js';

describe('PreFlight End-to-End System Integration (Dynamic Temporary Projects)', () => {
  let tempProj: TempProject | null = null;

  afterEach(() => {
    if (tempProj) {
      tempProj.cleanup();
      tempProj = null;
    }
  });

  it('runs complete PreFlight QA Flow with result merging & provenance on dynamic project', async () => {
    tempProj = createTempNodeProject();
    const testService = new PreflightTestService();
    const report = await testService.run({
      projectPath: tempProj.rootPath,
      enableAi: true
    });

    expect(report.mode).toBe('test');
    expect(report.projectProfile.name).toBe('temp-node-api');
    expect(report.results.length).toBeGreaterThanOrEqual(2);

    // Verify result merging and provenance tagging
    const initialResults = report.results.filter((r) => r.provenance === 'initial');
    expect(initialResults.length).toBeGreaterThanOrEqual(2);

    for (const res of report.results) {
      expect(['initial', 'ai-selected']).toContain(res.provenance);
    }

    // Render reports
    const reporter = new ReportEngine();
    const jsonOutput = JSON.parse(reporter.renderJson(report));
    expect(jsonOutput.version).toBe('1.0');
    expect(jsonOutput.verdict.code).toBeDefined();

    const terminalOutput = reporter.renderTerminal(report);
    expect(terminalOutput).toContain('PREFLIGHT AI - TEST READINESS REPORT');

    const mdOutput = reporter.renderMarkdown(report);
    expect(mdOutput).toContain('# PreFlight AI Report');
  }, 30000);

  it('runs complete PreFlight Deployment Flow with GO / NO-GO verdict & defect detection', async () => {
    tempProj = createTempBrokenDeploymentProject();
    const deployService = new PreflightDeployService();
    const report = await deployService.run({
      projectPath: tempProj.rootPath,
      enableAi: true
    });

    expect(report.mode).toBe('deploy');
    expect(report.projectProfile.name).toBe('temp-broken-deployment');

    // Broken deployment has committed .env file and hardcoded secrets -> overall status MUST be FAIL
    expect(report.overallStatus).toBe('FAIL');

    const reporter = new ReportEngine();
    const verdictCode = reporter.getVerdictCode(report.mode, report.overallStatus);
    expect(verdictCode).toBe('🔴 NO-GO');

    const terminalOutput = reporter.renderTerminal(report);
    expect(terminalOutput).toContain('🔴 NO-GO');

    // Verify secret values in evidence are redacted
    for (const res of report.results) {
      if (res.evidence?.stdout) {
        expect(res.evidence.stdout).not.toContain('productionSuperSecret99!');
        expect(res.evidence.stdout).not.toContain('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
      }
    }
  }, 30000);
});
