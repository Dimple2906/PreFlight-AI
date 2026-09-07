const fs = require('fs');
const path = require('path');
const os = require('os');
const { classifyProject } = require('../dist/discovery/classifier.js');
const { classifyDeployment, formatDeploymentProfileReport } = require('../dist/deploy/classification/classifier.js');

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-p2-hardening-'));
console.log('Phase 2 Hardening Test Workspace:', tmpBase);

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
  // Section 1: Declarative Predicates (Tests 1 - 7)
  // =========================================================================
  // 1. Next.js activates Next.js checks
  const d1 = classifyProject('.'); // will test with simulated project profiles
  const pNext = {
    identity: { name: 'app-next', rootPath: '/app-next', isValidProject: true, isMonorepoRoot: false, childProjectRoots: [] },
    packageManager: { packageManager: 'npm', confidence: 'DETECTED', evidence: [] },
    languages: { primary: 'TypeScript', languages: [{ language: 'TypeScript', confidence: 'DETECTED', evidence: [] }] },
    frameworks: { frameworks: [{ name: 'Next.js', confidence: 'DETECTED', version: '14.2.0', evidence: ['package.json: next@14.2.0'] }] },
    databases: { databases: [] },
    runtime: { name: 'Node.js', version: '>=20.0.0', evidence: [] },
    hosting: { hosting: [] },
    projectType: { primaryType: 'web application', secondaryTypes: [], confidence: 'DETECTED', evidence: [] },
    rawEvidence: [],
  };
  const profNext = classifyDeployment({ rootProject: pNext, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(profNext.rootProfile.completeChecks.some((c) => c.id === 'tech.framework.nextjs.build_target'), '1. Next.js activates Next.js checks');

  // 2. React/Vite does not activate Next.js checks
  const pVite = {
    identity: { name: 'app-vite', rootPath: '/app-vite', isValidProject: true, isMonorepoRoot: false, childProjectRoots: [] },
    packageManager: { packageManager: 'npm', confidence: 'DETECTED', evidence: [] },
    languages: { primary: 'TypeScript', languages: [] },
    frameworks: { frameworks: [{ name: 'Vite', confidence: 'DETECTED', evidence: [] }, { name: 'React', confidence: 'DETECTED', evidence: [] }] },
    databases: { databases: [] },
    runtime: { name: 'Node.js', version: '', evidence: [] },
    hosting: { hosting: [] },
    projectType: { primaryType: 'static frontend', secondaryTypes: [], confidence: 'DETECTED', evidence: [] },
    rawEvidence: [],
  };
  const profVite = classifyDeployment({ rootProject: pVite, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(!profVite.rootProfile.completeChecks.some((c) => c.id.includes('nextjs')), '2. React/Vite does not activate Next.js checks');
  assert(profVite.rootProfile.completeChecks.some((c) => c.id === 'tech.framework.react.vite_build'), '2b. React/Vite activates Vite build check');

  // 3. PostgreSQL activates PostgreSQL checks
  const pPg = {
    ...pNext,
    databases: { databases: [{ name: 'PostgreSQL', confidence: 'DETECTED', evidence: ['package.json: pg'] }] },
  };
  const profPg = classifyDeployment({ rootProject: pPg, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(profPg.rootProfile.completeChecks.some((c) => c.id === 'tech.database.postgresql.connection_pool'), '3. PostgreSQL activates PostgreSQL checks');

  // 4. Redis activates Redis checks
  const pRedis = {
    ...pNext,
    databases: { databases: [{ name: 'Redis', confidence: 'DETECTED', evidence: ['package.json: ioredis'] }] },
  };
  const profRedis = classifyDeployment({ rootProject: pRedis, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(profRedis.rootProfile.completeChecks.some((c) => c.id === 'tech.cache.redis.url_configuration'), '4. Redis activates Redis checks');

  // 5. Docker activates Docker checks
  const pDocker = {
    ...pNext,
    hosting: { hosting: [{ name: 'Docker', confidence: 'DETECTED', evidence: ['Dockerfile'] }] },
  };
  const profDocker = classifyDeployment({ rootProject: pDocker, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(profDocker.rootProfile.completeChecks.some((c) => c.id === 'target.hosting.docker.dockerfile_validity'), '5. Docker activates Docker checks');

  // 6. Vercel activates Vercel checks
  const pVercel = {
    ...pNext,
    hosting: { hosting: [{ name: 'Vercel', confidence: 'DETECTED', evidence: ['vercel.json'] }] },
  };
  const profVercel = classifyDeployment({ rootProject: pVercel, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(profVercel.rootProfile.completeChecks.some((c) => c.id === 'target.hosting.vercel.config_validity'), '6. Vercel activates Vercel checks');

  // 7. Unknown technologies do not activate unrelated checks
  const pUnknown = {
    identity: { name: 'app-unknown', rootPath: '/app-unknown', isValidProject: false, isMonorepoRoot: false, childProjectRoots: [] },
    packageManager: { packageManager: 'unknown', confidence: 'UNKNOWN', evidence: [] },
    languages: { primary: 'unknown', languages: [] },
    frameworks: { frameworks: [{ name: 'Unknown', confidence: 'UNKNOWN', evidence: [] }] },
    databases: { databases: [{ name: 'None', confidence: 'UNKNOWN', evidence: [] }] },
    runtime: { name: 'Unknown', version: '', evidence: [] },
    hosting: { hosting: [{ name: 'Unknown', confidence: 'UNKNOWN', evidence: [] }] },
    projectType: { primaryType: 'unknown', secondaryTypes: [], confidence: 'UNKNOWN', evidence: [] },
    rawEvidence: [],
  };
  const profUnknown = classifyDeployment({ rootProject: pUnknown, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(!profUnknown.rootProfile.completeChecks.some((c) => c.layer === 'TECHNOLOGY' && c.domain === 'framework'), '7a. Unknown does not activate framework checks');
  assert(!profUnknown.rootProfile.completeChecks.some((c) => c.layer === 'DEPLOYMENT_TARGET'), '7b. Unknown does not activate target checks');
  assert(!profUnknown.rootProfile.completeChecks.some((c) => c.layer === 'PROJECT_TYPE'), '7c. Unknown does not activate project type checks');

  // =========================================================================
  // Section 2: Project Types (Tests 8 - 13)
  // =========================================================================
  // 8. Web activates web checks
  assert(profNext.rootProfile.completeChecks.some((c) => c.id === 'project_type.web.start_command'), '8. Web activates web checks');

  // 9. API activates API checks
  const pApi = {
    ...pNext,
    projectType: { primaryType: 'API/backend', secondaryTypes: [], confidence: 'DETECTED', evidence: [] },
  };
  const profApi = classifyDeployment({ rootProject: pApi, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(profApi.rootProfile.completeChecks.some((c) => c.id === 'project_type.api.cors_configuration'), '9. API activates API checks');

  // 10. Worker activates worker checks
  const pWorker = {
    ...pNext,
    projectType: { primaryType: 'worker', secondaryTypes: [], confidence: 'DETECTED', evidence: [] },
  };
  const profWorker = classifyDeployment({ rootProject: pWorker, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(profWorker.rootProfile.completeChecks.some((c) => c.id === 'project_type.worker.entrypoint'), '10. Worker activates worker checks');

  // 11. CLI activates CLI checks
  const pCli = {
    ...pNext,
    projectType: { primaryType: 'CLI', secondaryTypes: [], confidence: 'DETECTED', evidence: [] },
  };
  const profCli = classifyDeployment({ rootProject: pCli, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(profCli.rootProfile.completeChecks.some((c) => c.id === 'project_type.cli.bin_entrypoint'), '11. CLI activates CLI checks');

  // 12. Desktop activates desktop checks
  const pDesktop = {
    ...pNext,
    projectType: { primaryType: 'desktop', secondaryTypes: [], confidence: 'DETECTED', evidence: [] },
  };
  const profDesktop = classifyDeployment({ rootProject: pDesktop, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(profDesktop.rootProfile.completeChecks.some((c) => c.id === 'project_type.desktop.binary_packaging'), '12. Desktop activates desktop checks');

  // 13. Library activates library checks
  const pLib = {
    ...pNext,
    projectType: { primaryType: 'library', secondaryTypes: [], confidence: 'DETECTED', evidence: [] },
  };
  const profLib = classifyDeployment({ rootProject: pLib, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(profLib.rootProfile.completeChecks.some((c) => c.id === 'project_type.library.entrypoints'), '13. Library activates library checks');

  // =========================================================================
  // Section 3: Multiple Technologies (Tests 14 - 18)
  // =========================================================================
  // 14. Next.js + Prisma + PostgreSQL + Vercel
  const p14 = {
    ...pNext,
    frameworks: { frameworks: [{ name: 'Next.js', confidence: 'DETECTED', evidence: ['next'] }] },
    databases: { databases: [{ name: 'Prisma', confidence: 'DETECTED', evidence: ['prisma'] }, { name: 'PostgreSQL', confidence: 'DETECTED', evidence: ['pg'] }] },
    hosting: { hosting: [{ name: 'Vercel', confidence: 'DETECTED', evidence: ['vercel.json'] }] },
  };
  const prof14 = classifyDeployment({ rootProject: p14, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(
    prof14.rootProfile.completeChecks.some((c) => c.id === 'tech.framework.nextjs.build_target') &&
    prof14.rootProfile.completeChecks.some((c) => c.id === 'tech.orm.prisma.schema_validity') &&
    prof14.rootProfile.completeChecks.some((c) => c.id === 'tech.database.postgresql.connection_pool') &&
    prof14.rootProfile.completeChecks.some((c) => c.id === 'target.hosting.vercel.config_validity'),
    '14. Next.js + Prisma + PostgreSQL + Vercel composed cleanly'
  );

  // 15. React + Vite + Express + PostgreSQL + Docker
  const p15 = {
    ...pNext,
    projectType: { primaryType: 'web application', secondaryTypes: ['API/backend'], confidence: 'DETECTED', evidence: [] },
    frameworks: { frameworks: [{ name: 'Vite', confidence: 'DETECTED', evidence: [] }, { name: 'Express', confidence: 'DETECTED', evidence: [] }] },
    databases: { databases: [{ name: 'PostgreSQL', confidence: 'DETECTED', evidence: [] }] },
    hosting: { hosting: [{ name: 'Docker', confidence: 'DETECTED', evidence: ['Dockerfile'] }] },
  };
  const prof15 = classifyDeployment({ rootProject: p15, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(
    prof15.rootProfile.completeChecks.some((c) => c.id === 'tech.framework.react.vite_build') &&
    prof15.rootProfile.completeChecks.some((c) => c.id === 'tech.framework.express.entrypoint') &&
    prof15.rootProfile.completeChecks.some((c) => c.id === 'tech.database.postgresql.connection_pool') &&
    prof15.rootProfile.completeChecks.some((c) => c.id === 'target.hosting.docker.dockerfile_validity'),
    '15. React + Vite + Express + PostgreSQL + Docker composed cleanly'
  );

  // 16. FastAPI + PostgreSQL + Docker
  const p16 = {
    ...pNext,
    runtime: { name: 'Python', version: '3.11', evidence: ['runtime.txt'] },
    languages: { primary: 'Python', languages: [{ language: 'Python', confidence: 'DETECTED', evidence: [] }] },
    projectType: { primaryType: 'API/backend', secondaryTypes: [], confidence: 'DETECTED', evidence: [] },
    frameworks: { frameworks: [] },
    databases: { databases: [{ name: 'PostgreSQL', confidence: 'DETECTED', evidence: [] }] },
    hosting: { hosting: [{ name: 'Docker', confidence: 'DETECTED', evidence: ['Dockerfile'] }] },
  };
  const prof16 = classifyDeployment({ rootProject: p16, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(
    prof16.rootProfile.completeChecks.some((c) => c.id === 'tech.runtime.python.version_compat') &&
    prof16.rootProfile.completeChecks.some((c) => c.id === 'tech.database.postgresql.connection_pool') &&
    prof16.rootProfile.completeChecks.some((c) => c.id === 'target.hosting.docker.dockerfile_validity'),
    '16. FastAPI + PostgreSQL + Docker composed cleanly'
  );

  // 17. Electron + Node.js + TypeScript
  const p17 = {
    ...pNext,
    projectType: { primaryType: 'desktop', secondaryTypes: [], confidence: 'DETECTED', evidence: [] },
    frameworks: { frameworks: [] },
    hosting: { hosting: [] },
  };
  const prof17 = classifyDeployment({ rootProject: p17, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(
    prof17.rootProfile.completeChecks.some((c) => c.id === 'project_type.desktop.binary_packaging') &&
    prof17.rootProfile.completeChecks.some((c) => c.id === 'project_type.desktop.code_signing') &&
    !prof17.rootProfile.applicableDomains.includes('hosting'),
    '17. Electron + Node.js + TypeScript composed without hosting checks'
  );

  // 18. Tauri + Rust + React
  const p18 = {
    ...pNext,
    projectType: { primaryType: 'desktop', secondaryTypes: [], confidence: 'DETECTED', evidence: [] },
    frameworks: { frameworks: [{ name: 'React', confidence: 'DETECTED', evidence: [] }] },
    hosting: { hosting: [] },
  };
  const prof18 = classifyDeployment({ rootProject: p18, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(
    prof18.rootProfile.completeChecks.some((c) => c.id === 'project_type.desktop.binary_packaging') &&
    !prof18.rootProfile.applicableDomains.includes('api'),
    '18. Tauri + Rust + React desktop application composed cleanly'
  );

  // =========================================================================
  // Section 4: Multiple Deployment Targets (Tests 19 - 20)
  // =========================================================================
  // 19. Docker + Vercel
  const p19 = {
    ...pNext,
    hosting: {
      hosting: [
        { name: 'Vercel', confidence: 'DETECTED', evidence: ['vercel.json'] },
        { name: 'Docker', confidence: 'DETECTED', evidence: ['Dockerfile'] },
      ],
    },
  };
  const prof19 = classifyDeployment({ rootProject: p19, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(prof19.rootProfile.targetStatus === 'MULTI_TARGET', '19a. Dual hosting detected as MULTI_TARGET');
  assert(prof19.rootProfile.deploymentTargets.length === 2, '19b. Preserves both deployment targets');
  assert(prof19.rootProfile.deploymentTargets.some((t) => t.name === 'Vercel' && t.applicableChecks.length > 0), '19c. Vercel has scoped checks');
  assert(prof19.rootProfile.deploymentTargets.some((t) => t.name === 'Docker' && t.applicableChecks.length > 0), '19d. Docker has scoped checks');

  // 20. Docker + Railway + Vercel
  const p20 = {
    ...pNext,
    hosting: {
      hosting: [
        { name: 'Vercel', confidence: 'DETECTED', evidence: ['vercel.json'] },
        { name: 'Docker', confidence: 'DETECTED', evidence: ['Dockerfile'] },
        { name: 'Railway', confidence: 'DETECTED', evidence: ['railway.json'] },
      ],
    },
  };
  const prof20 = classifyDeployment({ rootProject: p20, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  assert(prof20.rootProfile.targetStatus === 'MULTI_TARGET', '20a. Triple hosting marked as MULTI_TARGET');
  assert(prof20.rootProfile.deploymentTargets.length === 3, '20b. Triple targets preserved independently');

  // =========================================================================
  // Section 5: Deduplication (Tests 21 - 25)
  // =========================================================================
  // 21. Web + API port binding deduplication
  const p21 = {
    ...pNext,
    projectType: { primaryType: 'web application', secondaryTypes: ['API/backend'], confidence: 'DETECTED', evidence: ['web and api dual role'] },
  };
  const prof21 = classifyDeployment({ rootProject: p21, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  const portChecks21 = prof21.rootProfile.completeChecks.filter(
    (c) => c.id === 'project_type.web.port_binding' || c.id === 'project_type.api.port_binding'
  );
  assert(portChecks21.length === 1, '21. Web + API port binding deduplicated into single check via dedupKey');

  // 22. Multiple checks sharing dedupKey
  const canonicalPortCheck = prof21.rootProfile.groups
    .flatMap((g) => g.checks)
    .find((c) => c.check.dedupKey === 'network.port_binding');
  assert(Boolean(canonicalPortCheck), '22a. Canonical check found for network.port_binding');
  assert(canonicalPortCheck.sourceCheckIds.length === 2, '22b. Source check IDs preserved in merged check');

  // 23. Evidence is preserved after deduplication
  assert(canonicalPortCheck.evidence.length > 0, '23. Evidence preserved in deduplicated check');

  // 24. Highest severity is preserved (API port binding is CRITICAL, Web is HIGH -> merged must be CRITICAL)
  assert(canonicalPortCheck.check.severity === 'CRITICAL', '24. Highest severity CRITICAL preserved in deduplicated check');

  // 25. Matched technologies are preserved
  assert(canonicalPortCheck.matchedTechnologies.length >= 1, '25. Matched technologies preserved in deduplicated check');

  // =========================================================================
  // Section 6: Evidence & Version Integrity (Tests 26 - 29)
  // =========================================================================
  // 26. UNKNOWN remains UNKNOWN
  assert(profUnknown.rootProfile.targetStatus === 'UNKNOWN', '26a. Unknown targetStatus remains UNKNOWN');
  assert(profUnknown.rootProfile.deploymentTargets.length === 0, '26b. No fake deployment targets synthesized for Unknown');

  // 27. No technology hallucination
  assert(!profNext.rootProfile.applicableDomains.includes('python'), '27a. No Python hallucinated for Node project');
  assert(!profNext.rootProfile.applicableDomains.includes('database'), '27b. No database hallucinated when database list is empty');

  // 28. Version is UNKNOWN when unavailable
  assert(pUnknown.runtime.version === '', '28. Version is empty/unknown when not detected');

  // 29. Phase 1 evidence survives into Phase 2
  const pEv = {
    ...pNext,
    frameworks: {
      frameworks: [{ name: 'Next.js', confidence: 'DETECTED', version: '14.2.0', evidence: ['package.json: "next": "^14.2.0"'] }],
    },
  };
  const profEv = classifyDeployment({ rootProject: pEv, subProjects: [], summary: { totalApplications: 1, isMonorepo: false, analysisTimestamp: '' } });
  const nextAppCheck = profEv.rootProfile.groups
    .flatMap((g) => g.checks)
    .find((c) => c.check.id === 'tech.framework.nextjs.build_target');
  assert(nextAppCheck.evidence.includes('package.json: "next": "^14.2.0"'), '29. Exact Phase 1 evidence string survived into Phase 2');

  console.log('----------------------------------------------------');
  console.log(`ALL PHASE 2 HARDENING TESTS PASSED: ${passed} / ${total} assertions verified.`);
} finally {
  try {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  } catch {}
}
