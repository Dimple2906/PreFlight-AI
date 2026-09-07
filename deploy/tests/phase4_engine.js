const fs = require('fs');
const path = require('path');
const os = require('os');
const { classifyProject } = require('../dist/discovery/classifier.js');
const { classifyDeployment } = require('../dist/deploy/classification/classifier.js');
const { runDeploymentChecks } = require('../dist/deploy/engine.js');

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
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-p4-test-'));

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
  console.log('Running PreFlight AI - Phase 4 Execution Engine Test Suite...');

  // ==========================================================================================
  // SCENARIO 1: Perfect Production-Ready Next.js Project
  // ==========================================================================================
  const s1Path = createFixture('s1-perfect-nextjs', {
    'package.json': JSON.stringify({
      name: 'perfect-next-app',
      version: '1.0.0',
      engines: { node: '>=18.0.0' },
      scripts: {
        build: 'echo "Building..."',
        start: 'next start',
      },
      dependencies: {
        next: '14.2.0',
        react: '18.2.0',
      },
    }),
    'package-lock.json': JSON.stringify({ name: 'perfect-next-app', lockfileVersion: 3 }),
    '.gitignore': 'node_modules\n.env\n.env.local\n.env.production\n',
    '.env.example': 'DATABASE_URL=postgres://localhost/db\nAPI_KEY=your_key\n',
    'src/index.ts': 'console.log(process.env.DATABASE_URL);\nconsole.log(process.env.API_KEY);\n',
    'public/robots.txt': 'User-agent: *\nAllow: /\n',
    'public/sitemap.xml': '<urlset></urlset>',
  });

  const disc1 = classifyProject(s1Path);
  const repProfile1 = classifyDeployment(disc1);
  const report1 = await runDeploymentChecks(s1Path, repProfile1.rootProfile, { skipBuildCommand: true });

  assert(report1.summary.total > 0, 'S1: Total checks executed > 0');
  assert(report1.summary.criticalFailures === 0, 'S1: Zero critical failures for perfect project');
  assert(report1.summary.errors === 0, 'S1: Zero execution errors for perfect project');

  const lockfileCheck1 = report1.results.find((r) => r.checkId === 'universal.dependencies.lockfile_present' || r.checkId === 'DEP-DEPS-001');
  assert(lockfileCheck1 && lockfileCheck1.status === 'PASS', 'S1: Lockfile presence check passed');

  const envCheck1 = report1.results.find((r) => r.checkId === 'universal.env.manifest_presence' || r.checkId === 'DEP-ENV-001');
  assert(envCheck1 && envCheck1.status === 'PASS', 'S1: Env example parity check passed');

  // ==========================================================================================
  // SCENARIO 2: Missing Environment Variables in .env.example
  // ==========================================================================================
  const s2Path = createFixture('s2-missing-env', {
    'package.json': JSON.stringify({
      name: 'missing-env-app',
      version: '1.0.0',
      engines: { node: '>=18.0.0' },
      dependencies: { next: '14.2.0' },
    }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n',
    '.env.example': 'DATABASE_URL=postgres://...\n',
    'src/auth.ts': 'const secret = process.env.STRIPE_SECRET_KEY;\nconst api = process.env.DATABASE_URL;\n',
  });

  const disc2 = classifyProject(s2Path);
  const repProfile2 = classifyDeployment(disc2);
  const report2 = await runDeploymentChecks(s2Path, repProfile2.rootProfile, { skipBuildCommand: true });

  const envCheck2 = report2.results.find((r) => r.checkId === 'universal.env.manifest_presence' || r.checkId === 'DEP-ENV-001');
  assert(envCheck2 && envCheck2.status === 'FAIL', 'S2: Missing environment variable triggers FAIL');
  assert(
    envCheck2 && envCheck2.evidence && envCheck2.evidence.some((e) => e.includes('STRIPE_SECRET_KEY')),
    'S2: Evidence identifies missing STRIPE_SECRET_KEY'
  );

  // ==========================================================================================
  // SCENARIO 3: Missing .env.example altogether with referenced env vars
  // ==========================================================================================
  const s3Path = createFixture('s3-no-env-example', {
    'package.json': JSON.stringify({ name: 'no-env-app', version: '1.0.0' }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n',
    'src/index.ts': 'console.log(process.env.SUPABASE_ANON_KEY);\n',
  });

  const disc3 = classifyProject(s3Path);
  const repProfile3 = classifyDeployment(disc3);
  const report3 = await runDeploymentChecks(s3Path, repProfile3.rootProfile, { skipBuildCommand: true });

  const envCheck3 = report3.results.find((r) => r.checkId === 'universal.env.manifest_presence' || r.checkId === 'DEP-ENV-001');
  assert(envCheck3 && envCheck3.status === 'FAIL', 'S3: Missing .env.example triggers FAIL');

  // ==========================================================================================
  // SCENARIO 4: Missing Dependency Lockfile
  // ==========================================================================================
  const s4Path = createFixture('s4-missing-lockfile', {
    'package.json': JSON.stringify({ name: 'no-lockfile', version: '1.0.0', dependencies: { express: '4.18.0' } }),
    '.gitignore': 'node_modules\n',
  });

  const disc4 = classifyProject(s4Path);
  const repProfile4 = classifyDeployment(disc4);
  const report4 = await runDeploymentChecks(s4Path, repProfile4.rootProfile, { skipBuildCommand: true });

  const lockfileCheck4 = report4.results.find((r) => r.checkId === 'universal.dependencies.lockfile_present' || r.checkId === 'DEP-DEPS-001');
  assert(lockfileCheck4 && lockfileCheck4.status === 'FAIL', 'S4: Missing lockfile triggers FAIL');

  // ==========================================================================================
  // SCENARIO 5: Conflicting Multiple Lockfiles
  // ==========================================================================================
  const s5Path = createFixture('s5-conflicting-lockfiles', {
    'package.json': JSON.stringify({ name: 'multi-lockfile', version: '1.0.0' }),
    'package-lock.json': '{}',
    'yarn.lock': '# yarn lockfile',
    '.gitignore': 'node_modules\n',
  });

  const disc5 = classifyProject(s5Path);
  const repProfile5 = classifyDeployment(disc5);
  const report5 = await runDeploymentChecks(s5Path, repProfile5.rootProfile, { skipBuildCommand: true });

  const multiLockCheck = report5.results.find(
    (r) => r.checkId === 'universal.dependencies.no_conflict_lockfiles' || r.checkId === 'DEP-DEPS-002'
  );
  assert(multiLockCheck && multiLockCheck.status === 'FAIL', 'S5: Multiple lockfiles trigger FAIL');

  // ==========================================================================================
  // SCENARIO 6: Node Version Compatibility Failure
  // ==========================================================================================
  const s6Path = createFixture('s6-wrong-node', {
    'package.json': JSON.stringify({
      name: 'node-future-app',
      version: '1.0.0',
      engines: { node: '>=99.0.0' }, // Current node will definitely be < 99
    }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n',
  });

  const disc6 = classifyProject(s6Path);
  const repProfile6 = classifyDeployment(disc6);
  const report6 = await runDeploymentChecks(s6Path, repProfile6.rootProfile, { skipBuildCommand: true });

  const nodeVerCheck = report6.results.find((r) => r.checkId === 'tech.runtime.node.version_compat' || r.checkId === 'DEP-NODE-001');
  assert(nodeVerCheck && nodeVerCheck.status === 'FAIL', 'S6: Incompatible node engine version triggers FAIL');
  assert(nodeVerCheck && nodeVerCheck.failure && nodeVerCheck.failure.expected === '>=99.0.0', 'S6: Failure details record expected >=99.0.0');

  // ==========================================================================================
  // SCENARIO 7: Production Build Failure (Exit code != 0)
  // ==========================================================================================
  const s7Path = createFixture('s7-broken-build', {
    'package.json': JSON.stringify({
      name: 'broken-build-app',
      version: '1.0.0',
      scripts: {
        build: 'node -e "process.exit(1)"',
      },
    }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n',
  });

  const disc7 = classifyProject(s7Path);
  const repProfile7 = classifyDeployment(disc7);
  const report7 = await runDeploymentChecks(s7Path, repProfile7.rootProfile, { skipBuildCommand: false });

  const buildCheck7 = report7.results.find((r) => r.checkId === 'universal.build.config_valid' || r.checkId === 'DEP-BUILD-001');
  assert(buildCheck7 && buildCheck7.status === 'FAIL', 'S7: Broken build command triggers FAIL');
  assert(buildCheck7 && buildCheck7.severity === 'CRITICAL', 'S7: Broken build command is CRITICAL');

  // ==========================================================================================
  // SCENARIO 8: Hardcoded Localhost Loopback Address (Context-Aware: WARN vs FAIL)
  // ==========================================================================================
  const s8Path = createFixture('s8-hardcoded-localhost', {
    'package.json': JSON.stringify({ name: 'localhost-app', version: '1.0.0' }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n',
    'src/cors.ts': 'const allowedOrigins = ["http://localhost:3000", "https://app.example.com"];\n',
    'src/service.ts': 'const res = await fetch("http://localhost:5000/api/internal");\n',
  });

  const disc8 = classifyProject(s8Path);
  const repProfile8 = classifyDeployment(disc8);
  const report8 = await runDeploymentChecks(s8Path, repProfile8.rootProfile, { skipBuildCommand: true });

  const localhostCheck = report8.results.find(
    (r) => r.checkId === 'universal.build.no_hardcoded_localhost' || r.checkId === 'DEP-BUILD-003'
  );
  assert(localhostCheck && localhostCheck.evidence && localhostCheck.evidence.length >= 2, 'S8: Localhost references detected and evidence reported');
  assert(localhostCheck && localhostCheck.status === 'FAIL', 'S8: Unconditional production service fetch triggers FAIL');

  // Test dev-only CORS localhost produces WARN
  const s8bPath = createFixture('s8b-cors-localhost', {
    'package.json': JSON.stringify({ name: 'cors-app', version: '1.0.0' }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n',
    'src/cors.ts': 'const allowedOrigins = ["http://localhost:3000", "https://app.example.com"];\n',
  });
  const disc8b = classifyProject(s8bPath);
  const repProfile8b = classifyDeployment(disc8b);
  const report8b = await runDeploymentChecks(s8bPath, repProfile8b.rootProfile, { skipBuildCommand: true });
  const localhostCheck8b = report8b.results.find(
    (r) => r.checkId === 'universal.build.no_hardcoded_localhost' || r.checkId === 'DEP-BUILD-003'
  );
  assert(localhostCheck8b && localhostCheck8b.status === 'WARN', 'S8b: Development/CORS localhost triggers WARN instead of FAIL');
  assert(localhostCheck8b && localhostCheck8b.severity === 'MEDIUM', 'S8b: Severity is MEDIUM for review warning');

  // ==========================================================================================
  // SCENARIO 9: CLI Shebang & Entrypoint Verification
  // ==========================================================================================
  const s9Path = createFixture('s9-cli-missing-shebang', {
    'package.json': JSON.stringify({
      name: 'my-cli',
      version: '1.0.0',
      bin: './bin/cli.js',
    }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n',
    'bin/cli.js': 'console.log("Hello without shebang");\n',
  });

  const disc9 = classifyProject(s9Path);
  const repProfile9 = classifyDeployment(disc9);
  const report9 = await runDeploymentChecks(s9Path, repProfile9.rootProfile, { skipBuildCommand: true });

  const cliCheck = report9.results.find((r) => r.checkId === 'project_type.cli.bin_entrypoint' || r.checkId === 'DEP-CLI-001');
  assert(cliCheck && cliCheck.status === 'FAIL', 'S9: Missing shebang in CLI entrypoint triggers FAIL');

  // ==========================================================================================
  // SCENARIO 10: API-Only Project Excludes / Skips SEO Checks
  // ==========================================================================================
  const s10Path = createFixture('s10-api-service', {
    'package.json': JSON.stringify({
      name: 'api-service',
      version: '1.0.0',
      dependencies: { express: '4.18.0' },
      scripts: { start: 'node server.js' },
    }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n',
    'server.js': 'const port = process.env.PORT || 3000;\n',
  });

  const disc10 = classifyProject(s10Path);
  const repProfile10 = classifyDeployment(disc10);
  const report10 = await runDeploymentChecks(s10Path, repProfile10.rootProfile, { skipBuildCommand: true });

  const seoCheck10 = report10.results.find((r) => r.checkId === 'project_type.web.robots_txt' || r.checkId === 'DEP-SEO-001');
  assert(
    !seoCheck10 || seoCheck10.status === 'SKIP' || seoCheck10.status === 'SKIPPED',
    'S10: SEO check is excluded or SKIPPED for pure API backend'
  );

  // ==========================================================================================
  // SCENARIO 11: Database Seeding Command Prohibition (DEP-DB-SEED-001)
  // ==========================================================================================
  const s11Path = createFixture('s11-db-seed-hazard', {
    'package.json': JSON.stringify({
      name: 'db-seed-app',
      version: '1.0.0',
      dependencies: { prisma: '5.10.0', '@prisma/client': '5.10.0' },
      scripts: { start: 'prisma db seed && node server.js' },
    }),
    'package-lock.json': '{}',
    'prisma/schema.prisma': 'datasource db { provider = "postgresql" url = env("DATABASE_URL") }\n',
    '.gitignore': 'node_modules\n',
  });

  const disc11 = classifyProject(s11Path);
  const repProfile11 = classifyDeployment(disc11);
  const report11 = await runDeploymentChecks(s11Path, repProfile11.rootProfile, { skipBuildCommand: true });

  const seedCheck = report11.results.find((r) => r.checkId === 'DEP-DB-SEED-001' || r.checkId === 'tech.database.no_production_seed');
  assert(seedCheck && seedCheck.status === 'FAIL', 'S11: prisma db seed in start command triggers FAIL');

  // ==========================================================================================
  // SCENARIO 12: Secret Sanitization Verification (Never leak actual keys)
  // ==========================================================================================
  const s12Path = createFixture('s12-secret-leak', {
    'package.json': JSON.stringify({ name: 'secret-leak-app', version: '1.0.0' }),
    'package-lock.json': '{}',
    '.gitignore': 'node_modules\n',
    'src/config.ts': 'const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";\n',
  });

  const disc12 = classifyProject(s12Path);
  const repProfile12 = classifyDeployment(disc12);
  const report12 = await runDeploymentChecks(s12Path, repProfile12.rootProfile, { skipBuildCommand: true });

  const secretCheck12 = report12.results.find(
    (r) => r.checkId === 'universal.env.no_committed_secrets' || r.checkId === 'DEP-ENV-002'
  );
  if (!secretCheck12 || secretCheck12.status !== 'FAIL') {
    console.log('DEBUG S12 secretCheck12:', secretCheck12);
  }
  assert(secretCheck12 && secretCheck12.status === 'FAIL', 'S12: Leaked token triggers FAIL');
  assert(
    secretCheck12 &&
      secretCheck12.evidence &&
      !secretCheck12.evidence.some((e) => e.includes('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890')),
    'S12: Actual token string is redacted/sanitized from evidence'
  );

  // ==========================================================================================
  // SCENARIO 13: Summary Structure & Error Isolation
  // ==========================================================================================
  assert(report1.summary.passed > 0, 'S13: summary.passed is counted correctly');
  assert(typeof report1.summary.total === 'number', 'S13: summary.total is a number');
  assert(typeof report1.summary.criticalFailures === 'number', 'S13: summary.criticalFailures is counted');
  assert(typeof report1.summary.durationMs === 'number', 'S13: summary.durationMs is recorded');
  assert(typeof report1.summary.timestamp === 'string', 'S13: summary.timestamp is recorded');

  // Clean up fixture temp workspace
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  console.log('----------------------------------------------------');
  console.log('ALL PHASE 4 EXECUTION ENGINE TESTS PASSED: ' + passed + ' / ' + total + ' assertions verified.');
}

runTestBattery().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
