import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { PreflightTestService } from '../services/test.service.js';
import { PreflightDeployService } from '../services/deploy.service.js';
import { ReportEngine } from '@preflight/reporter';
import { ProjectInspector } from '@preflight/discovery';
import { ProjectClassifier } from '@preflight/classifier';
import {
  createTempNodeProject,
  createTempVulnerableProject,
  createTempNextProject,
  createTempBrokenDeploymentProject,
  TempProject
} from '../../../../tests/utils/temp-projects.js';

describe('PreFlight QA Pass - Dynamic Projects & Edge Cases', () => {
  let tempProjs: TempProject[] = [];

  afterEach(() => {
    for (const p of tempProjs) {
      p.cleanup();
    }
    tempProjs = [];
  });

  describe('Dynamic Project Verification', () => {
    it('verifies healthy dynamic node-api passes both test and deploy', async () => {
      const proj = createTempNodeProject();
      tempProjs.push(proj);

      const testService = new PreflightTestService();
      const deployService = new PreflightDeployService();

      const testReport = await testService.run({ projectPath: proj.rootPath, enableAi: false });
      expect(testReport.overallStatus).toBe('PASS');

      const deployReport = await deployService.run({ projectPath: proj.rootPath, enableAi: false });
      expect(deployReport.overallStatus).toBe('PASS');

      const reporter = new ReportEngine();
      expect(reporter.getVerdictCode('deploy', deployReport.overallStatus)).toBe('🟢 GO');
    }, 30000);

    it('verifies vulnerable dynamic api fails test and deploy', async () => {
      const proj = createTempVulnerableProject();
      tempProjs.push(proj);

      const testService = new PreflightTestService();
      const deployService = new PreflightDeployService();

      const testReport = await testService.run({ projectPath: proj.rootPath, enableAi: false });
      expect(testReport.overallStatus).toBe('FAIL');

      const deployReport = await deployService.run({ projectPath: proj.rootPath, enableAi: false });
      expect(deployReport.overallStatus).toBe('FAIL');

      const reporter = new ReportEngine();
      expect(reporter.getVerdictCode('deploy', deployReport.overallStatus)).toBe('🔴 NO-GO');
    }, 30000);

    it('verifies dynamic nextjs-app classification', async () => {
      const proj = createTempNextProject();
      tempProjs.push(proj);

      const inspector = new ProjectInspector();
      const classifier = new ProjectClassifier();

      const discovered = await inspector.inspect(proj.rootPath);
      const profile = classifier.classify(discovered);

      expect(profile.frameworks).toContain('nextjs');
    }, 30000);

    it('verifies dynamic broken-deployment detects build failure & committed .env', async () => {
      const proj = createTempBrokenDeploymentProject();
      tempProjs.push(proj);

      const deployService = new PreflightDeployService();
      const deployReport = await deployService.run({ projectPath: proj.rootPath, enableAi: false });

      expect(deployReport.overallStatus).toBe('FAIL');
      const reporter = new ReportEngine();
      expect(reporter.getVerdictCode('deploy', deployReport.overallStatus)).toBe('🔴 NO-GO');
    }, 30000);
  });

  describe('Edge Cases Resilience', () => {
    it('handles empty project directory gracefully', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-empty-'));
      try {
        const inspector = new ProjectInspector();
        const classifier = new ProjectClassifier();
        const discovered = await inspector.inspect(tmpDir);
        const profile = classifier.classify(discovered);

        expect(profile.projectType).toBeDefined();
        expect(profile.languages).toBeDefined();
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('handles invalid malformed package.json gracefully', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-invalid-pkg-'));
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{ invalid json structure ...', 'utf-8');
      try {
        const inspector = new ProjectInspector();
        const classifier = new ProjectClassifier();
        const discovered = await inspector.inspect(tmpDir);
        const profile = classifier.classify(discovered);

        expect(profile.name).toBe(path.basename(tmpDir));
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('handles missing package.json gracefully', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-no-pkg-'));
      fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask==3.0.0\n', 'utf-8');
      try {
        const inspector = new ProjectInspector();
        const classifier = new ProjectClassifier();
        const discovered = await inspector.inspect(tmpDir);
        const profile = classifier.classify(discovered);

        expect(profile.languages).toBeDefined();
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('runs when AI is disabled (--no-ai)', async () => {
      const proj = createTempNodeProject();
      tempProjs.push(proj);

      const testService = new PreflightTestService();
      const report = await testService.run({ projectPath: proj.rootPath, enableAi: false });

      expect(report.aiAnalysis).toBeUndefined();
      expect(report.overallStatus).toBe('PASS');
    }, 30000);
  });
});
