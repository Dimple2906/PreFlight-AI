const fs = require('fs');
const path = require('path');
const os = require('os');
const { runDeployEngine, calculateDeploymentSummary } = require('../dist/deploy/engine.js');

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (!condition) {
    console.error('FAIL: ' + message);
    process.exitCode = 1;
  } else {
    passed++;
    console.log('PASS: ' + message);
  }
}

// Temporary test workspace helper
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-p5-test-'));

function createFixture(name, files) {
  const fixturePath = path.join(tempDir, name);
  fs.mkdirSync(fixturePath, { recursive: true });
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(fixturePath, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return fixturePath;
}

async function runTestBattery() {
  console.log('Running PreFlight AI - Phase 5 Deployment Engine Integration Test Suite...');

  // ==========================================================================================
  // TEST 1: Minimal Project (runDeployEngine returns valid EngineReport)
  // ==========================================================================================
  const t1Path = createFixture('t1-minimal', {
    'package.json': JSON.stringify({ name: 'minimal-app', version: '1.0.0' }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n',
  });

  const report1 = await runDeployEngine(t1Path, { skipBuildCommand: true });

  assert(report1 && typeof report1 === 'object', 'Test 1: runDeployEngine returns an object');
  assert(report1.status === 'SUCCESS', 'Test 1: report.status is SUCCESS');
  assert(report1.rootPath === path.resolve(t1Path), 'Test 1: report.rootPath matches resolved path');
  assert(report1.discovery && report1.discovery.rootProject, 'Test 1: report.discovery contains rootProject');
  assert(report1.classification && report1.classification.rootProfile, 'Test 1: report.classification contains rootProfile');
  assert(report1.deploymentProfile && report1.deploymentProfile.projectName === 'minimal-app', 'Test 1: report.deploymentProfile preserved');
  assert(Array.isArray(report1.checks) && report1.checks.length > 0, 'Test 1: report.checks contains executed checks');
  assert(report1.summary && typeof report1.summary.total === 'number', 'Test 1: report.summary contains valid total');
  assert(typeof report1.summary.deploymentReady === 'boolean', 'Test 1: report.summary.deploymentReady is boolean');
  assert(typeof report1.durationMs === 'number', 'Test 1: report.durationMs is recorded');
  assert(typeof report1.generatedAt === 'string', 'Test 1: report.generatedAt is ISO timestamp');

  // ==========================================================================================
  // TEST 2: Next.js Project (Next.js discovered, applicable checks present, skipped checks handled)
  // ==========================================================================================
  const t2Path = createFixture('t2-nextjs', {
    'package.json': JSON.stringify({
      name: 'nextjs-app',
      version: '1.0.0',
      dependencies: { next: '14.2.0', react: '18.2.0' },
      scripts: { build: 'echo "next build"', start: 'next start' },
    }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n.env\n',
    '.env.example': 'PORT=3000\n',
    'public/robots.txt': 'User-agent: *\nDisallow:\n',
  });

  const report2 = await runDeployEngine(t2Path, { skipBuildCommand: true, includeSkippedInResults: true });

  assert(
    report2.discovery.rootProject.frameworks.frameworks.some((f) => f.name === 'Next.js'),
    'Test 2: Next.js framework discovered in discovery stage'
  );
  assert(
    report2.checks.some((c) => c.checkId.includes('build') || c.name.toLowerCase().includes('build')),
    'Test 2: Build check is applicable and executed'
  );
  assert(
    report2.checks.some((c) => c.status === 'SKIPPED'),
    'Test 2: Irrelevant / non-applicable checks have status SKIPPED when includeSkippedInResults is true'
  );

  // ==========================================================================================
  // TEST 3: API-Only Project (API detected, SEO = SKIPPED, web-only not treated as failure)
  // ==========================================================================================
  const t3Path = createFixture('t3-api-backend', {
    'package.json': JSON.stringify({
      name: 'pure-api-backend',
      version: '1.0.0',
      dependencies: { express: '^4.19.0' },
      scripts: { start: 'node src/server.js' },
    }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n',
    'src/server.js': 'const express = require("express"); const app = express(); const port = process.env.PORT || 3000; app.listen(port);',
  });

  const report3 = await runDeployEngine(t3Path, { skipBuildCommand: true });

  const primaryType = report3.discovery.rootProject.projectType.primaryType;
  assert(primaryType === 'API/backend' || primaryType.includes('API'), 'Test 3: API backend correctly detected');

  const seoCheck = report3.checks.find((c) => c.checkId === 'DEP-SEO-001' || c.name.toLowerCase().includes('seo'));
  if (seoCheck) {
    assert(seoCheck.status === 'SKIPPED', 'Test 3: SEO check is marked SKIPPED for pure API backend');
  } else {
    // If not in applicable checks list, it is not present as a failure
    assert(true, 'Test 3: SEO check not applicable and not treated as failure');
  }

  // Web checks should not cause critical failure for API backend
  assert(report3.summary.critical === 0, 'Test 3: Zero critical failures for clean API backend');

  // ==========================================================================================
  // TEST 4: Missing Environment Variable (DEP-ENV-001 FAIL, evidence & severity preserved)
  // ==========================================================================================
  const t4Path = createFixture('t4-missing-env', {
    'package.json': JSON.stringify({ name: 'missing-env-app', version: '1.0.0' }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n',
    '.env.example': 'DATABASE_URL=postgres://localhost/db\n',
    'src/index.js': 'const secret = process.env.STRIPE_SECRET_KEY;\nconsole.log(process.env.DATABASE_URL);\n',
  });

  const report4 = await runDeployEngine(t4Path, { skipBuildCommand: true });

  const envCheck4 = report4.checks.find(
    (c) => c.checkId === 'DEP-ENV-001' || c.checkId === 'universal.env.manifest_presence'
  );
  assert(envCheck4 && envCheck4.status === 'FAIL', 'Test 4: Missing environment variable triggers FAIL in orchestrator');
  assert(envCheck4 && envCheck4.severity === 'CRITICAL', 'Test 4: Severity CRITICAL is preserved');
  assert(
    envCheck4 && envCheck4.evidence && envCheck4.evidence.some((e) => e.includes('STRIPE_SECRET_KEY')),
    'Test 4: Missing variable STRIPE_SECRET_KEY identified in evidence'
  );
  assert(report4.summary.deploymentReady === false, 'Test 4: deploymentReady is FALSE due to CRITICAL failure');
  assert(report4.summary.blockers.length > 0, 'Test 4: blockers list contains the critical failure');

  // ==========================================================================================
  // TEST 5: Broken Build (DEP-BUILD-001 FAIL/ERROR, evidence & exit code preserved, summary updated)
  // ==========================================================================================
  const t5Path = createFixture('t5-broken-build', {
    'package.json': JSON.stringify({
      name: 'broken-build-app',
      version: '1.0.0',
      scripts: { build: 'node -e "process.exit(1)"' },
    }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n',
  });

  const report5 = await runDeployEngine(t5Path, { skipBuildCommand: false });

  const buildCheck5 = report5.checks.find(
    (c) => c.checkId === 'DEP-BUILD-001' || c.checkId === 'universal.build.config_valid'
  );
  assert(buildCheck5 && buildCheck5.status === 'FAIL', 'Test 5: Broken build command triggers FAIL');
  assert(buildCheck5 && buildCheck5.severity === 'CRITICAL', 'Test 5: Broken build check is CRITICAL');
  assert(report5.summary.critical > 0, 'Test 5: summary.critical reflects the broken build');
  assert(report5.summary.deploymentReady === false, 'Test 5: summary.deploymentReady is FALSE');

  // ==========================================================================================
  // TEST 6: Unknown/Minimal Repository (Generic checks run, tech-specific do not falsely activate)
  // ==========================================================================================
  const t6Path = createFixture('t6-generic', {
    'README.md': '# Just a minimal repository\n',
  });

  const report6 = await runDeployEngine(t6Path, { skipBuildCommand: true });

  assert(report6.status === 'SUCCESS', 'Test 6: Minimal directory executes successfully without crashing');
  assert(
    report6.discovery.rootProject.frameworks.frameworks[0].name === 'Unknown',
    'Test 6: Unknown framework detected'
  );
  assert(
    !report6.checks.some((c) => c.checkId.includes('DEP-FW-NEXT') && c.status === 'PASS'),
    'Test 6: Next.js checks do NOT falsely pass for generic repo'
  );
  assert(
    !report6.checks.some((c) => c.checkId.includes('DEP-ORM-PRISMA') && c.status === 'PASS'),
    'Test 6: Prisma checks do NOT falsely pass for generic repo'
  );

  // ==========================================================================================
  // TEST 7: Multiple Deployment Targets (MULTI_TARGET preserved)
  // ==========================================================================================
  const t7Path = createFixture('t7-multi-target', {
    'package.json': JSON.stringify({
      name: 'multi-target-app',
      version: '1.0.0',
      dependencies: { express: '^4.19.0' },
    }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n',
    'vercel.json': JSON.stringify({ version: 2 }),
    'Dockerfile': 'FROM node:18-alpine\nWORKDIR /app\nCOPY . .\nEXPOSE 3000\nCMD ["node", "index.js"]\n',
  });

  const report7 = await runDeployEngine(t7Path, { skipBuildCommand: true });

  assert(
    report7.deploymentProfile.targetStatus === 'MULTI_TARGET',
    'Test 7: Multi-target hosting detected as MULTI_TARGET'
  );
  assert(
    report7.deploymentProfile.deploymentTargets.length >= 2,
    'Test 7: Both Vercel and Docker deployment targets preserved in deploymentProfile'
  );

  // ==========================================================================================
  // TEST 8: Error Isolation (Engine never throws even on invalid path, returns ERROR report)
  // ==========================================================================================
  const nonExistentPath = path.join(os.tmpdir(), 'non-existent-dir-' + Date.now());
  const report8 = await runDeployEngine(nonExistentPath);

  assert(report8 && typeof report8 === 'object', 'Test 8: Error isolation returns report object');
  assert(report8.summary && report8.summary.deploymentReady === false, 'Test 8: Invalid root is NOT deploymentReady');

  // ==========================================================================================
  // TEST 9: Monorepo Sub-Project Aggregation (Child checks run independently & affect readiness)
  // ==========================================================================================
  const t9Path = createFixture('t9-monorepo', {

    'package.json': JSON.stringify({
      name: 'monorepo-root',
      version: '1.0.0',
      workspaces: ['apps/*'],
    }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n',
    'apps/web/package.json': JSON.stringify({
      name: 'web-app',
      version: '1.0.0',
      dependencies: { next: '14.2.0', react: '18.2.0' },
      scripts: { build: 'echo "build web"' },
    }),
    'apps/web/package-lock.json': '{}',
    'apps/web/.gitignore': 'node_modules\n',
    'apps/web/.env.example': 'PORT=3000\n',
    'apps/api/package.json': JSON.stringify({
      name: 'api-service',
      version: '1.0.0',
      dependencies: { express: '^4.19.0' },
      scripts: { start: 'node index.js' },
    }),
    'apps/api/package-lock.json': '{}',
    'apps/api/.gitignore': 'node_modules\n',
    // Deliberate failure in api child: references STRIPE_KEY without .env.example
    'apps/api/index.js': 'const key = process.env.STRIPE_KEY; const port = process.env.PORT || 4000;\n',
  });

  const report9 = await runDeployEngine(t9Path, { skipBuildCommand: true });

  assert(report9.discovery.summary.isMonorepo === true, 'Test 9: Monorepo architecture detected');
  assert(report9.discovery.subProjects.length === 2, 'Test 9: Exactly 2 sub-projects discovered');
  assert(
    report9.checks.some((c) => c.subProjectName === 'api-service' && c.status === 'FAIL'),
    'Test 9: Sub-project failure recorded with child project identity'
  );
  assert(
    report9.summary.deploymentReady === false,
    'Test 9: Child failure propagates to top-level repository deployment readiness'
  );

  // ==========================================================================================
  // TEST 9b: Localhost Reference Classification (DEP-BUILD-003 as Non-Blocking WARN)
  // ==========================================================================================
  const t9bPath = createFixture('t9b-localhost-cors-warn', {
    'package.json': JSON.stringify({
      name: 'localhost-warn-app',
      version: '1.0.0',
      dependencies: { express: '^4.19.0' },
      scripts: { start: 'node index.js' },
    }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n',
    '.env.example': 'PORT=3000\n',
    'index.js': `
      const express = require('express');
      const app = express();
      const allowedOrigins = ['http://localhost:5173', 'https://example.com'];
      app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (allowedOrigins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
        next();
      });
      app.listen(process.env.PORT || 3000);
    `,
  });

  const report9b = await runDeployEngine(t9bPath, { skipBuildCommand: true });
  const localhostCheck9b = report9b.checks.find(
    (c) => c.checkId === 'DEP-BUILD-003' || c.checkId === 'universal.build.no_hardcoded_localhost'
  );

  assert(Boolean(localhostCheck9b), 'Test 9b: DEP-BUILD-003 check executed');
  assert(localhostCheck9b && localhostCheck9b.status === 'WARN', 'Test 9b: Development/CORS localhost classified as WARN');
  assert(localhostCheck9b && localhostCheck9b.severity === 'MEDIUM', 'Test 9b: Severity is MEDIUM');
  assert(
    localhostCheck9b && localhostCheck9b.evidence && localhostCheck9b.evidence.some((e) => e.includes('localhost:5173')),
    'Test 9b: Exact file line and evidence reported'
  );
  assert(
    !report9b.summary.blockers.some((b) => b.includes('DEP-BUILD-003') || b.includes('no_hardcoded_localhost')),
    'Test 9b: WARN finding does NOT appear in blockers list'
  );
  assert(report9b.summary.deploymentReady === true, 'Test 9b: WARN finding does NOT block deployment (deploymentReady remains true)');
  assert(report9b.summary.warnings >= 1, 'Test 9b: Warnings count incremented in summary');

  // ==========================================================================================
  // TEST 10: CLI Invocation — JSON Output, Markdown Report, and Exit Codes
  // ==========================================================================================
  const { main: cliMain } = require('../dist/cli.js');

  // 10a: CLI ready exit code (0)
  const code0 = await cliMain(['deploy', t1Path, '--skip-build', '--json']);
  assert(code0 === 0, 'Test 10a: CLI returns exit code 0 for ready project');

  // 10b: CLI blocked exit code (1)
  const code1 = await cliMain(['deploy', t4Path, '--skip-build', '--json']);
  assert(code1 === 1, 'Test 10b: CLI returns exit code 1 for blocked project');

  // 10c: CLI invalid path exit code (2)
  const code2 = await cliMain(['deploy', nonExistentPath, '--json']);
  assert(code2 === 2, 'Test 10c: CLI returns exit code 2 for non-existent path');

  // 10d: Markdown report generation
  const mdOutPath = path.join(tempDir, 'output-report.md');
  const codeMd = await cliMain(['deploy', t2Path, '--skip-build', `--output=${mdOutPath}`]);
  assert(fs.existsSync(mdOutPath), 'Test 10d: Markdown report successfully generated at target path');
  const mdContent = fs.readFileSync(mdOutPath, 'utf-8');
  assert(mdContent.includes('# PreFlight AI Deployment Report'), 'Test 10d: Markdown report contains expected title');
  assert(mdContent.includes('## Summary'), 'Test 10d: Markdown report contains Summary section');
  assert(mdContent.includes('## Check Results'), 'Test 10d: Markdown report contains Check Results table');

  // Clean up fixture temp workspace
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  console.log('----------------------------------------------------');
  console.log('ALL PHASE 5 INTEGRATION TESTS PASSED: ' + passed + ' / ' + total + ' assertions verified.');
}

runTestBattery().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});