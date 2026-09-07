const fs = require('fs');
const path = require('path');
const os = require('os');
const { classifyProject } = require('../dist/discovery/classifier.js');
const { classifyDeployment, formatDeploymentProfileReport } = require('../dist/deploy/classification/classifier.js');

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-p2-test-'));
console.log('Phase 2 Test Workspace:', tmpBase);

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    passed++;
    console.log(`PASS: ${message}`);
  }
}

try {
  // =========================================================================
  // SCENARIO 1: Next.js + Prisma + PostgreSQL + Vercel
  // =========================================================================
  const s1Dir = path.join(tmpBase, 's1-next-prisma-vercel');
  fs.mkdirSync(path.join(s1Dir, 'prisma'), { recursive: true });
  fs.writeFileSync(
    path.join(s1Dir, 'package.json'),
    JSON.stringify({
      name: 'next-prisma-vercel-app',
      dependencies: {
        next: '^14.2.0',
        react: '^18.2.0',
        '@prisma/client': '^5.10.0',
        pg: '^8.11.0',
      },
      devDependencies: {
        prisma: '^5.10.0',
        typescript: '^5.4.0',
      },
      scripts: {
        build: 'next build',
        start: 'next start',
      },
    })
  );
  fs.writeFileSync(path.join(s1Dir, 'package-lock.json'), '{}');
  fs.writeFileSync(path.join(s1Dir, 'next.config.mjs'), 'export default {};');
  fs.writeFileSync(path.join(s1Dir, 'vercel.json'), '{}');
  fs.writeFileSync(path.join(s1Dir, 'prisma', 'schema.prisma'), 'datasource db { provider = "postgresql" }');

  const disc1 = classifyProject(s1Dir);
  const p2_1 = classifyDeployment(disc1);

  assert(p2_1.rootProfile.applicableDomains.includes('universal'), 'S1 includes universal domain');
  assert(p2_1.rootProfile.applicableDomains.includes('web'), 'S1 includes web domain');
  assert(p2_1.rootProfile.applicableDomains.includes('framework'), 'S1 includes framework domain');
  assert(p2_1.rootProfile.applicableDomains.includes('orm'), 'S1 includes orm domain');
  assert(p2_1.rootProfile.applicableDomains.includes('database'), 'S1 includes database domain');
  assert(p2_1.rootProfile.applicableDomains.includes('hosting'), 'S1 includes hosting domain');
  assert(!p2_1.rootProfile.applicableDomains.includes('desktop'), 'S1 excludes desktop domain');
  assert(!p2_1.rootProfile.applicableDomains.includes('cli'), 'S1 excludes cli domain');

  const hasNextBuild = p2_1.rootProfile.completeChecks.some((c) => c.id === 'tech.framework.nextjs.build_target');
  const hasPrismaSchema = p2_1.rootProfile.completeChecks.some((c) => c.id === 'tech.orm.prisma.schema_validity');
  const hasPgPool = p2_1.rootProfile.completeChecks.some((c) => c.id === 'tech.database.postgresql.connection_pool');
  const hasVercel = p2_1.rootProfile.completeChecks.some((c) => c.id === 'target.hosting.vercel.config_validity');
  const hasDocker = p2_1.rootProfile.completeChecks.some((c) => c.id === 'target.hosting.docker.dockerfile_validity');

  assert(hasNextBuild, 'S1 has Next.js build check');
  assert(hasPrismaSchema, 'S1 has Prisma schema check');
  assert(hasPgPool, 'S1 has PostgreSQL pool check');
  assert(hasVercel, 'S1 has Vercel check');
  assert(!hasDocker, 'S1 does not have Docker check');

  // =========================================================================
  // SCENARIO 2: React + Vite + Express + Docker
  // =========================================================================
  const s2Dir = path.join(tmpBase, 's2-vite-express-docker');
  fs.mkdirSync(s2Dir, { recursive: true });
  fs.writeFileSync(
    path.join(s2Dir, 'package.json'),
    JSON.stringify({
      name: 'vite-express-docker-app',
      dependencies: {
        react: '^18.2.0',
        express: '^4.19.0',
      },
      devDependencies: {
        vite: '^5.0.0',
      },
      scripts: {
        build: 'vite build',
        start: 'node dist/server.js',
      },
    })
  );
  fs.writeFileSync(path.join(s2Dir, 'Dockerfile'), 'FROM node:20\nCMD ["npm", "start"]\n');
  fs.writeFileSync(path.join(s2Dir, '.dockerignore'), 'node_modules\n');

  const disc2 = classifyProject(s2Dir);
  const p2_2 = classifyDeployment(disc2);

  const hasExpressCheck = p2_2.rootProfile.completeChecks.some((c) => c.id === 'tech.framework.express.entrypoint');
  const hasViteCheck = p2_2.rootProfile.completeChecks.some((c) => c.id === 'tech.framework.react.vite_build');
  const hasDockerCheck = p2_2.rootProfile.completeChecks.some((c) => c.id === 'target.hosting.docker.dockerfile_validity');
  const hasVercelCheck2 = p2_2.rootProfile.completeChecks.some((c) => c.id === 'target.hosting.vercel.config_validity');

  assert(hasExpressCheck, 'S2 has Express entrypoint check');
  assert(hasViteCheck, 'S2 has Vite build check');
  assert(hasDockerCheck, 'S2 has Dockerfile check');
  assert(!hasVercelCheck2, 'S2 does not have Vercel check');

  // =========================================================================
  // SCENARIO 3: Standalone CLI Tool
  // =========================================================================
  const s3Dir = path.join(tmpBase, 's3-cli-tool');
  fs.mkdirSync(path.join(s3Dir, 'bin'), { recursive: true });
  fs.writeFileSync(
    path.join(s3Dir, 'package.json'),
    JSON.stringify({
      name: 'my-awesome-cli',
      version: '1.0.0',
      bin: {
        'my-cli': './bin/cli.js',
      },
    })
  );
  fs.writeFileSync(path.join(s3Dir, 'package-lock.json'), '{}');

  const disc3 = classifyProject(s3Dir);
  const p2_3 = classifyDeployment(disc3);

  assert(p2_3.rootProfile.applicableDomains.includes('cli'), 'S3 includes CLI domain');
  assert(!p2_3.rootProfile.applicableDomains.includes('web'), 'S3 excludes web domain');
  assert(!p2_3.rootProfile.applicableDomains.includes('api'), 'S3 excludes api domain');
  assert(!p2_3.rootProfile.applicableDomains.includes('database'), 'S3 excludes database domain');
  const hasCliBin = p2_3.rootProfile.completeChecks.some((c) => c.id === 'project_type.cli.bin_entrypoint');
  assert(hasCliBin, 'S3 has CLI binary entrypoint check');

  // =========================================================================
  // SCENARIO 4: Electron Desktop Application
  // =========================================================================
  const s4Dir = path.join(tmpBase, 's4-electron');
  fs.mkdirSync(s4Dir, { recursive: true });
  fs.writeFileSync(
    path.join(s4Dir, 'package.json'),
    JSON.stringify({
      name: 'desktop-electron-app',
      main: 'main.js',
      dependencies: {
        electron: '^29.0.0',
      },
    })
  );

  const disc4 = classifyProject(s4Dir);
  disc4.rootProject.projectType.primaryType = 'desktop';
  const p2_4 = classifyDeployment(disc4);

  assert(p2_4.rootProfile.applicableDomains.includes('desktop'), 'S4 includes desktop domain');
  const hasDesktopPkg = p2_4.rootProfile.completeChecks.some((c) => c.id === 'project_type.desktop.binary_packaging');
  assert(hasDesktopPkg, 'S4 has desktop binary packaging check');

  // =========================================================================
  // SCENARIO 5: Python + FastAPI + Docker
  // =========================================================================
  const s5Dir = path.join(tmpBase, 's5-python-fastapi');
  fs.mkdirSync(s5Dir, { recursive: true });
  fs.writeFileSync(path.join(s5Dir, 'requirements.txt'), 'fastapi==0.110.0\nuvicorn==0.29.0\n');
  fs.writeFileSync(path.join(s5Dir, 'Dockerfile'), 'FROM python:3.11\nCMD ["uvicorn", "main:app"]\n');
  fs.writeFileSync(path.join(s5Dir, 'package.json'), JSON.stringify({ name: 'py-fastapi-service' }));

  const disc5 = classifyProject(s5Dir);
  disc5.rootProject.runtime.name = 'Python';
  disc5.rootProject.languages.languages.push({ language: 'Python', confidence: 'DETECTED', evidence: ['requirements.txt'] });
  disc5.rootProject.projectType.primaryType = 'API/backend';

  const p2_5 = classifyDeployment(disc5);
  const hasPythonManifest = p2_5.rootProfile.completeChecks.some((c) => c.id === 'tech.runtime.python.dependency_manifest');
  const hasPythonCompat = p2_5.rootProfile.completeChecks.some((c) => c.id === 'tech.runtime.python.version_compat');
  assert(hasPythonManifest, 'S5 has Python dependency manifest check');
  assert(hasPythonCompat, 'S5 has Python version compatibility check');
  assert(p2_5.rootProfile.completeChecks.some((c) => c.id === 'target.hosting.docker.dockerfile_validity'), 'S5 has Docker check');

  // =========================================================================
  // SCENARIO 6: Monorepo with Multiple Distinct Applications
  // =========================================================================
  const s6Dir = path.join(tmpBase, 's6-monorepo');
  fs.mkdirSync(path.join(s6Dir, 'apps', 'web'), { recursive: true });
  fs.mkdirSync(path.join(s6Dir, 'apps', 'api'), { recursive: true });
  fs.writeFileSync(
    path.join(s6Dir, 'package.json'),
    JSON.stringify({
      name: 'monorepo-parent',
      workspaces: ['apps/*'],
    })
  );
  fs.writeFileSync(
    path.join(s6Dir, 'apps', 'web', 'package.json'),
    JSON.stringify({
      name: '@corp/web-frontend',
      dependencies: { react: '^18.0.0', vite: '^5.0.0' },
    })
  );
  fs.writeFileSync(
    path.join(s6Dir, 'apps', 'api', 'package.json'),
    JSON.stringify({
      name: '@corp/api-backend',
      dependencies: { express: '^4.19.0', pg: '^8.11.0' },
    })
  );

  const disc6 = classifyProject(s6Dir);
  const p2_6 = classifyDeployment(disc6);

  assert(p2_6.summary.isMonorepo === true, 'S6 summary isMonorepo is true');
  assert(p2_6.subProjectProfiles.length === 2, 'S6 has 2 sub-project profiles');
  const webProfile = p2_6.subProjectProfiles.find((p) => p.projectName === '@corp/web-frontend');
  const apiProfile = p2_6.subProjectProfiles.find((p) => p.projectName === '@corp/api-backend');
  assert(Boolean(webProfile), 'S6 has web sub-project profile');
  assert(Boolean(apiProfile), 'S6 has api sub-project profile');
  assert(webProfile.completeChecks.some((c) => c.id === 'tech.framework.react.vite_build'), 'S6 web profile has Vite check');
  assert(apiProfile.completeChecks.some((c) => c.id === 'tech.framework.express.entrypoint'), 'S6 api profile has Express check');

  // =========================================================================
  // SCENARIO 7: Unknown/Minimal Project
  // =========================================================================
  const s7Dir = path.join(tmpBase, 's7-minimal');
  fs.mkdirSync(s7Dir, { recursive: true });
  fs.writeFileSync(path.join(s7Dir, 'README.md'), '# Minimal Readme\n');
  fs.writeFileSync(path.join(s7Dir, 'package.json'), JSON.stringify({ name: 'minimal-pkg' }));

  const disc7 = classifyProject(s7Dir);
  const p2_7 = classifyDeployment(disc7);

  assert(p2_7.rootProfile.applicableDomains.includes('universal'), 'S7 includes universal checks');
  assert(!p2_7.rootProfile.applicableDomains.includes('hosting'), 'S7 excludes hosting checks');
  assert(!p2_7.rootProfile.applicableDomains.includes('database'), 'S7 excludes database checks');
  assert(!p2_7.rootProfile.applicableDomains.includes('desktop'), 'S7 excludes desktop checks');

  // =========================================================================
  // SCENARIO 8: Multiple Databases (PostgreSQL + Redis)
  // =========================================================================
  const s8Dir = path.join(tmpBase, 's8-multi-db');
  fs.mkdirSync(s8Dir, { recursive: true });
  fs.writeFileSync(
    path.join(s8Dir, 'package.json'),
    JSON.stringify({
      name: 'multi-db-app',
      dependencies: {
        pg: '^8.11.0',
        ioredis: '^5.3.0',
        express: '^4.19.0',
      },
    })
  );

  const disc8 = classifyProject(s8Dir);
  const p2_8 = classifyDeployment(disc8);

  const hasPgCheck = p2_8.rootProfile.completeChecks.some((c) => c.id === 'tech.database.postgresql.connection_pool');
  const hasRedisCheck = p2_8.rootProfile.completeChecks.some((c) => c.id === 'tech.cache.redis.url_configuration');

  assert(hasPgCheck, 'S8 includes PostgreSQL check');
  assert(hasRedisCheck, 'S8 includes Redis check');
  assert(p2_8.rootProfile.applicableDomains.includes('database'), 'S8 includes database domain');
  assert(p2_8.rootProfile.applicableDomains.includes('cache'), 'S8 includes cache domain');

  // =========================================================================
  // SCENARIO 9: Deduplication Verification
  // =========================================================================
  const s9Dir = path.join(tmpBase, 's9-dedup');
  fs.mkdirSync(path.join(s9Dir, 'src', 'app'), { recursive: true });
  fs.mkdirSync(path.join(s9Dir, 'src', 'server'), { recursive: true });
  fs.writeFileSync(
    path.join(s9Dir, 'package.json'),
    JSON.stringify({
      name: 'fullstack-dedup',
      dependencies: { next: '^14.0.0', react: '^18.0.0' },
    })
  );
  fs.writeFileSync(path.join(s9Dir, 'next.config.js'), 'module.exports = {};');

  const disc9 = classifyProject(s9Dir);
  const p2_9 = classifyDeployment(disc9);

  // In fullstack, project_type.api.port_binding and project_type.web.port_binding are deduplicated
  const portChecks = p2_9.rootProfile.completeChecks.filter(
    (c) => c.id === 'project_type.web.port_binding' || c.id === 'project_type.api.port_binding'
  );
  assert(portChecks.length === 1, 'S9 deduplicates web and api port binding into a single check');
  assert(
    portChecks[0].id === 'project_type.web.port_binding',
    'S9 kept web port binding and merged reason'
  );

  // =========================================================================
  // SCENARIO 10: Profile Levels & Severities & Automation Distribution
  // =========================================================================
  const s10Dir = path.join(tmpBase, 's10-profile-levels');
  fs.mkdirSync(path.join(s10Dir, 'prisma'), { recursive: true });
  fs.writeFileSync(
    path.join(s10Dir, 'package.json'),
    JSON.stringify({
      name: 'complete-audit-target',
      dependencies: {
        next: '^14.2.0',
        react: '^18.2.0',
        '@prisma/client': '^5.10.0',
        pg: '^8.11.0',
      },
      devDependencies: {
        prisma: '^5.10.0',
      },
    })
  );
  fs.writeFileSync(path.join(s10Dir, 'package-lock.json'), '{}');
  fs.writeFileSync(path.join(s10Dir, 'vercel.json'), '{}');
  fs.writeFileSync(path.join(s10Dir, 'prisma', 'schema.prisma'), 'datasource db { provider = "postgresql" }');

  const disc10 = classifyProject(s10Dir);
  const p2_10 = classifyDeployment(disc10);

  const summary = p2_10.rootProfile.summary;
  assert(summary.minimumCheckCount > 0, 'S10 minimumCheckCount > 0');
  assert(summary.completeCheckCount > summary.minimumCheckCount, 'S10 completeCheckCount > minimumCheckCount');
  assert(summary.automaticCount > 0, 'S10 automaticCount > 0');
  assert(summary.partiallyAutomaticCount > 0, 'S10 partiallyAutomaticCount > 0');
  assert(summary.manualCount > 0, 'S10 manualCount > 0');
  assert(summary.bySeverity.CRITICAL > 0, 'S10 has CRITICAL severity checks');
  assert(summary.bySeverity.HIGH > 0, 'S10 has HIGH severity checks');

  // Verify CLI formatted output works without error
  const cliReport = formatDeploymentProfileReport(p2_10);
  assert(cliReport.includes('PREFLIGHT AI - DEPLOYMENT CLASSIFICATION'), 'S10 CLI report contains header');
  assert(cliReport.includes('ROOT PROJECT'), 'S10 CLI report formats root project');

  console.log('----------------------------------------------------');
  console.log(`ALL 10 PHASE 2 SCENARIOS PASSED: ${passed} / ${total} assertions verified.`);
} finally {
  try {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  } catch {}
}
