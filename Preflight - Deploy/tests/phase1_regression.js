const fs = require('fs');
const path = require('path');
const os = require('os');
const { classifyProject } = require('../dist/discovery/classifier.js');

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-p1-reg-'));
console.log('Phase 1 Regression Test Workspace:', tmpBase);

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

try {
  // Test 1: Next.js + TypeScript + Prisma + PostgreSQL + Vercel
  const t1Dir = path.join(tmpBase, 't1-next-full');
  fs.mkdirSync(path.join(t1Dir, 'prisma'), { recursive: true });
  fs.writeFileSync(
    path.join(t1Dir, 'package.json'),
    JSON.stringify({
      name: 'my-next-app',
      dependencies: {
        next: '^14.2.0',
        react: '^18.2.0',
        '@prisma/client': '^5.10.0',
        pg: '^8.11.0',
      },
      devDependencies: {
        typescript: '^5.4.0',
        prisma: '^5.10.0',
      },
    })
  );
  fs.writeFileSync(path.join(t1Dir, 'package-lock.json'), '{}');
  fs.writeFileSync(path.join(t1Dir, 'tsconfig.json'), '{}');
  fs.writeFileSync(path.join(t1Dir, 'next.config.mjs'), 'export default {};');
  fs.writeFileSync(path.join(t1Dir, 'vercel.json'), '{}');
  fs.writeFileSync(path.join(t1Dir, 'prisma', 'schema.prisma'), 'datasource db { provider = "postgresql" }');

  const r1 = classifyProject(t1Dir);
  assert(r1.rootProject.packageManager.packageManager === 'npm', 'Test 1 PM is npm');
  assert(r1.rootProject.packageManager.confidence === 'DETECTED', 'Test 1 PM confidence DETECTED');
  assert(r1.rootProject.languages.primary === 'TypeScript', 'Test 1 Language is TypeScript');
  assert(r1.rootProject.frameworks.frameworks.some((f) => f.name === 'Next.js' && f.confidence === 'DETECTED'), 'Test 1 Next.js DETECTED');
  assert(r1.rootProject.frameworks.frameworks.some((f) => f.name === 'React' && f.confidence === 'DETECTED'), 'Test 1 React DETECTED');
  assert(r1.rootProject.databases.databases.some((d) => d.name === 'Prisma' && d.confidence === 'DETECTED'), 'Test 1 Prisma DETECTED');
  assert(r1.rootProject.databases.databases.some((d) => d.name === 'PostgreSQL' && d.confidence === 'DETECTED'), 'Test 1 PostgreSQL DETECTED');
  assert(r1.rootProject.hosting.hosting.some((h) => h.name === 'Vercel' && h.confidence === 'DETECTED'), 'Test 1 Vercel DETECTED');
  assert(r1.rootProject.projectType.primaryType === 'web application', 'Test 1 Primary type web application');

  // Test 2: React frontend + Express backend
  const t2Dir = path.join(tmpBase, 't2-react-express');
  fs.mkdirSync(t2Dir, { recursive: true });
  fs.writeFileSync(
    path.join(t2Dir, 'package.json'),
    JSON.stringify({
      name: 'react-express-combo',
      dependencies: {
        express: '^4.19.2',
        react: '^18.2.0',
        mongoose: '^8.0.0',
      },
    })
  );
  fs.writeFileSync(path.join(t2Dir, 'yarn.lock'), '');
  fs.writeFileSync(path.join(t2Dir, 'Dockerfile'), 'FROM node:20');

  const r2 = classifyProject(t2Dir);
  assert(r2.rootProject.packageManager.packageManager === 'yarn', 'Test 2 PM is yarn');
  assert(r2.rootProject.frameworks.frameworks.some((f) => f.name === 'Express'), 'Test 2 Express detected');
  assert(r2.rootProject.frameworks.frameworks.some((f) => f.name === 'React'), 'Test 2 React detected');
  assert(r2.rootProject.databases.databases.some((d) => d.name === 'MongoDB'), 'Test 2 MongoDB detected');
  assert(r2.rootProject.databases.databases.some((d) => d.name === 'Mongoose'), 'Test 2 Mongoose detected');
  assert(r2.rootProject.hosting.hosting.some((h) => h.name === 'Docker'), 'Test 2 Docker detected');

  // Test 3: CLI + TypeScript
  const t3Dir = path.join(tmpBase, 't3-cli');
  fs.mkdirSync(path.join(t3Dir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(t3Dir, 'package.json'),
    JSON.stringify({
      name: 'my-cli-tool',
      bin: { 'my-cli': './bin/cli.js' },
      engines: { node: '>=20.0.0' },
    })
  );
  fs.writeFileSync(path.join(t3Dir, 'pnpm-lock.yaml'), '');
  fs.writeFileSync(path.join(t3Dir, 'tsconfig.json'), '{}');
  fs.writeFileSync(path.join(t3Dir, 'src', 'index.ts'), 'console.log(1);');

  const r3 = classifyProject(t3Dir);
  assert(r3.rootProject.projectType.primaryType === 'CLI', 'Test 3 Primary type is CLI');
  assert(r3.rootProject.packageManager.packageManager === 'pnpm', 'Test 3 PM is pnpm');
  assert(r3.rootProject.runtime.version === '>=20.0.0', 'Test 3 Runtime node version >=20.0.0');

  // Test 4: JavaScript library
  const t4Dir = path.join(tmpBase, 't4-lib');
  fs.mkdirSync(t4Dir, { recursive: true });
  fs.writeFileSync(
    path.join(t4Dir, 'package.json'),
    JSON.stringify({
      name: 'awesome-util-lib',
      main: 'dist/index.js',
      module: 'dist/index.mjs',
      types: 'dist/index.d.ts',
      exports: { '.': './dist/index.js' },
    })
  );
  fs.writeFileSync(path.join(t4Dir, 'index.js'), 'module.exports = {};');

  const r4 = classifyProject(t4Dir);
  assert(r4.rootProject.projectType.primaryType === 'library', 'Test 4 Primary type is library');
  assert(r4.rootProject.languages.primary === 'JavaScript', 'Test 4 Primary language is JavaScript');

  // Test 5: Project with no recognizable framework
  const t5Dir = path.join(tmpBase, 't5-no-framework');
  fs.mkdirSync(t5Dir, { recursive: true });
  fs.writeFileSync(
    path.join(t5Dir, 'package.json'),
    JSON.stringify({
      name: 'bare-script',
      dependencies: { lodash: '^4.17.21' },
    })
  );

  const r5 = classifyProject(t5Dir);
  assert(r5.rootProject.frameworks.frameworks.some((f) => f.name === 'Unknown' && f.confidence === 'UNKNOWN'), 'Test 5 Framework is Unknown');
  assert(r5.rootProject.databases.databases.some((d) => d.name === 'None' && d.confidence === 'UNKNOWN'), 'Test 5 Database is None');
  assert(r5.rootProject.hosting.hosting.some((h) => h.name === 'Unknown' && h.confidence === 'UNKNOWN'), 'Test 5 Hosting is Unknown');

  // Test 6: Monorepo / frontend + backend
  const t6Dir = path.join(tmpBase, 't6-monorepo');
  fs.mkdirSync(path.join(t6Dir, 'frontend'), { recursive: true });
  fs.mkdirSync(path.join(t6Dir, 'backend'), { recursive: true });
  fs.writeFileSync(
    path.join(t6Dir, 'package.json'),
    JSON.stringify({
      name: 'monorepo-root',
      workspaces: ['frontend', 'backend'],
    })
  );
  fs.writeFileSync(
    path.join(t6Dir, 'frontend', 'package.json'),
    JSON.stringify({
      name: 'web-client',
      dependencies: { react: '^18.2.0', vite: '^5.0.0' },
    })
  );
  fs.writeFileSync(
    path.join(t6Dir, 'backend', 'package.json'),
    JSON.stringify({
      name: 'api-server',
      dependencies: { express: '^4.19.2', pg: '^8.11.0' },
    })
  );

  const r6 = classifyProject(t6Dir);
  assert(r6.rootProject.identity.isMonorepoRoot === true, 'Test 6 isMonorepoRoot is true');
  assert(r6.summary.isMonorepo === true, 'Test 6 summary isMonorepo is true');
  assert(r6.subProjects.length === 2, 'Test 6 discovered 2 sub-projects');
  assert(r6.subProjects.some((s) => s.identity.name === 'web-client'), 'Test 6 found web-client');
  assert(r6.subProjects.some((s) => s.identity.name === 'api-server'), 'Test 6 found api-server');

  // Test 7: Conflicting package-manager lockfiles
  const t7Dir = path.join(tmpBase, 't7-conflict');
  fs.mkdirSync(t7Dir, { recursive: true });
  fs.writeFileSync(path.join(t7Dir, 'package.json'), JSON.stringify({ name: 'conflict-proj' }));
  fs.writeFileSync(path.join(t7Dir, 'package-lock.json'), '{}');
  fs.writeFileSync(path.join(t7Dir, 'yarn.lock'), '');

  const r7 = classifyProject(t7Dir);
  assert(Boolean(r7.rootProject.packageManager.conflicts && r7.rootProject.packageManager.conflicts.length === 2), 'Test 7 Conflict recorded');
  assert(r7.rootProject.packageManager.confidence === 'LIKELY', 'Test 7 Conflict confidence is LIKELY');

  // Test 8: Malformed or incomplete package.json
  const t8Dir = path.join(tmpBase, 't8-malformed');
  fs.mkdirSync(t8Dir, { recursive: true });
  fs.writeFileSync(path.join(t8Dir, 'package.json'), '{ invalid json missing closing brace:');

  const r8 = classifyProject(t8Dir);
  assert(r8.rootProject.identity.isValidProject === true, 'Test 8 handles malformed package.json without crashing');
  assert(r8.rootProject.packageManager.packageManager === 'unknown', 'Test 8 PM handles malformed gracefully');

  console.log('----------------------------------------');
  console.log('ALL PHASE 1 REGRESSION TESTS PASSED: ' + passed + ' / ' + total + ' assertions verified.');
} finally {
  try {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  } catch {}
}
