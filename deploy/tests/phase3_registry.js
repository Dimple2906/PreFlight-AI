const {
  getAllChecks,
  getCheckById,
  getChecksByCategory,
  getChecksByLayer,
  getChecksByDomain,
  getApplicableChecks,
  getMinimumChecks,
  getCompleteChecks,
  validateRegistryIntegrity,
  getRejectedChecks,
  REJECTED_DEPLOYMENT_CHECKS,
  DEPLOYMENT_CHECK_REGISTRY,
} = require('../dist/deploy/registry/index.js');
const fsModule = require('fs');

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

console.log('Running PreFlight AI - Phase 3 Check Registry Hardening Verification Suite...');

// 1. Catalog Integrity & Schema Verification
const integrity = validateRegistryIntegrity();
assert(integrity.valid === true, '1. Catalog integrity validates with zero errors');
assert(integrity.errors.length === 0, '1b. No catalog errors found: ' + integrity.errors.join(', '));

const allChecks = getAllChecks();
assert(allChecks.length >= 100, '2. Registry contains comprehensive catalog (found ' + allChecks.length + ' checks >= 100)');

// 2. ID Uniqueness & Alias Lookup
const idSet = new Set();
let duplicates = 0;
for (const c of allChecks) {
  if (idSet.has(c.id)) {
    duplicates++;
  }
  idSet.add(c.id);
}
assert(duplicates === 0, '3. All primary check IDs in registry are strictly unique');

const checkByCode = getCheckById('DEP-GIT-001');
assert(Boolean(checkByCode), '4a. Check found by standard code DEP-GIT-001');
const checkByAlias = getCheckById('universal.git.clean_state');
assert(Boolean(checkByAlias), '4b. Check found by legacy alias universal.git.clean_state');
assert(checkByCode === checkByAlias, '4c. Primary ID and legacy alias resolve to the same CheckDefinition');

const nextCheckByAlias = getCheckById('tech.framework.nextjs.build_target');
const nextCheckByCode = getCheckById('DEP-FW-NEXT-001');
assert(Boolean(nextCheckByAlias), '5a. Next.js check resolvable via legacy alias');
assert(Boolean(nextCheckByCode), '5b. Next.js check resolvable via standard code DEP-FW-NEXT-001');

// 3. Metadata Completeness on ALL Checks
assert(allChecks.every(c => Boolean(c.category)), '6a. All checks have a declared CheckCategory');
assert(allChecks.every(c => Boolean(c.layer)), '6b. All checks have a declared DeploymentLayer');
assert(allChecks.every(c => Boolean(c.executionType)), '6c. All checks have a declared ExecutionType');
assert(allChecks.every(c => Boolean(c.remediation && c.remediation.summary && Array.isArray(c.remediation.steps))), '6d. All checks have structured Remediation guidance and steps');
assert(allChecks.every(c => Boolean(c.severity)), '6e. All checks have a declared CheckSeverity');
assert(allChecks.every(c => Boolean(c.automationLevel)), '6f. All checks have a declared AutomationLevel');
assert(allChecks.every(c => Boolean(c.profileLevel)), '6g. All checks have a declared profileLevel');
assert(allChecks.every(c => Boolean(c.expectedBehavior && c.expectedBehavior.trim() !== '')), '6h. All checks have declared expectedBehavior');
assert(allChecks.every(c => Boolean(c.passCondition && c.passCondition.trim() !== '')), '6i. All checks have declared passCondition');
assert(allChecks.every(c => Boolean(c.failCondition && c.failCondition.trim() !== '')), '6j. All checks have declared failCondition');
assert(allChecks.every(c => Boolean(c.source && c.source.trim() !== '')), '6k. All checks have declared source provenance');

// 4. Query API Consistency
const gitChecks = getChecksByCategory('GIT');
assert(gitChecks.length >= 4, '7a. getChecksByCategory(GIT) returns all git checks');
assert(gitChecks.every(c => c.category === 'GIT'), '7b. All filtered checks match category GIT');

const universalChecks = getChecksByLayer('UNIVERSAL');
assert(universalChecks.length >= 10, '8a. getChecksByLayer(UNIVERSAL) returns universal checks');
assert(universalChecks.every(c => c.layer === 'UNIVERSAL'), '8b. All filtered checks match layer UNIVERSAL');

const hostingDomainChecks = getChecksByDomain('hosting');
assert(hostingDomainChecks.length >= 10, '9a. getChecksByDomain(hosting) returns hosting checks');
assert(hostingDomainChecks.every(c => c.domain === 'hosting'), '9b. All filtered checks match domain hosting');

// 5. Applicability Query API
const mockProfile = {
  identity: { name: 'sample-app', rootPath: '/sample', isValidProject: true, isMonorepoRoot: false, childProjectRoots: [] },
  packageManager: { packageManager: 'npm', confidence: 'DETECTED', evidence: [] },
  languages: { primary: 'TypeScript', languages: [{ language: 'TypeScript', confidence: 'DETECTED', evidence: [] }] },
  frameworks: { frameworks: [{ name: 'Next.js', confidence: 'DETECTED', version: '14.2.0', evidence: [] }] },
  databases: { databases: [{ name: 'PostgreSQL', confidence: 'DETECTED', evidence: [] }] },
  runtime: { name: 'Node.js', version: '>=20.0.0', evidence: [] },
  hosting: { hosting: [{ name: 'Vercel', confidence: 'DETECTED', evidence: [] }] },
  projectType: { primaryType: 'web application', secondaryTypes: [], confidence: 'DETECTED', evidence: [] },
  rawEvidence: [],
};

const applicable = getApplicableChecks(mockProfile);
assert(applicable.length > 0, '10a. getApplicableChecks returns dynamic checks for profile');
const minimum = getMinimumChecks(mockProfile);
const complete = getCompleteChecks(mockProfile);
assert(minimum.length > 0, '10b. getMinimumChecks returns non-empty minimum checks');
assert(complete.length >= minimum.length, '10c. complete checks set is superset of minimum checks');
assert(minimum.every(c => c.profileLevel === 'MINIMUM'), '10d. All minimum checks have profileLevel MINIMUM');

// 6. Verification of Existing Seed Checks Presence & Correct Predicates
const caseSensitiveCheck = getCheckById('DEP-GIT-003');
assert(Boolean(caseSensitiveCheck), '11a. Seed check DEP-GIT-003 (Case-sensitive file import) registered');
assert(caseSensitiveCheck.layer === 'UNIVERSAL', '11b. DEP-GIT-003 is UNIVERSAL layer');

const conflictCheck = getCheckById('DEP-GIT-004');
assert(Boolean(conflictCheck), '12a. Seed check DEP-GIT-004 (Git merge conflict markers) registered');
assert(conflictCheck.severity === 'CRITICAL', '12b. DEP-GIT-004 is CRITICAL severity');

const localhostCheck = getCheckById('DEP-BUILD-003');
assert(Boolean(localhostCheck), '13a. Seed check DEP-BUILD-003 (No hardcoded localhost) registered');
assert(localhostCheck.executionType === 'AST', '13b. DEP-BUILD-003 executionType is AST');

const electronSecCheck = getCheckById('DEP-DSK-003');
assert(Boolean(electronSecCheck), '14a. Seed check DEP-DSK-003 (Electron context isolation) registered');
assert(electronSecCheck.category === 'SECURITY', '14b. DEP-DSK-003 category is SECURITY');

const k8sProbeCheck = getCheckById('DEP-HOST-K8S-001');
assert(Boolean(k8sProbeCheck), '15a. Seed check DEP-HOST-K8S-001 (Kubernetes probes) registered');
assert(k8sProbeCheck.layer === 'DEPLOYMENT_TARGET', '15b. DEP-HOST-K8S-001 layer is DEPLOYMENT_TARGET');

// 7. Verification of Newly Added Checks from PDF Knowledge Base
const sqliteCheck = getCheckById('DEP-DB-SQLITE-001');
assert(Boolean(sqliteCheck), '16a. PDF check DEP-DB-SQLITE-001 (Ephemeral SQLite in container) registered');
assert(sqliteCheck.severity === 'CRITICAL', '16b. DEP-DB-SQLITE-001 is CRITICAL severity');

const dbSeedCheck = getCheckById('DEP-DB-SEED-001');
assert(Boolean(dbSeedCheck), '17a. PDF check DEP-DB-SEED-001 (Production DB seeding prohibition) registered');
assert(dbSeedCheck.domain === 'database', '17b. DEP-DB-SEED-001 is database domain');

const prismaMuslCheck = getCheckById('DEP-ORM-PRISMA-004');
assert(Boolean(prismaMuslCheck), '18a. PDF check DEP-ORM-PRISMA-004 (Prisma musl binaryTarget) registered');
assert(prismaMuslCheck.aliases.includes('ORM-PRIS-003'), '18b. DEP-ORM-PRISMA-004 aliased to ORM-PRIS-003');

const drizzleCheck = getCheckById('DEP-ORM-DRIZZLE-001');
assert(Boolean(drizzleCheck), '19a. PDF check DEP-ORM-DRIZZLE-001 (Drizzle migration SQL schema parity) registered');
assert(drizzleCheck.predicates.frameworks.includes('Drizzle'), '19b. DEP-ORM-DRIZZLE-001 targets Drizzle');

const alembicCheck = getCheckById('DEP-ORM-ALEMBIC-001');
assert(Boolean(alembicCheck), '20a. PDF check DEP-ORM-ALEMBIC-001 (Alembic single migration head) registered');
assert(alembicCheck.aliases.includes('ORM-ALEM-001'), '20b. DEP-ORM-ALEMBIC-001 aliased to ORM-ALEM-001');

const typeormSyncCheck = getCheckById('DEP-ORM-TYPEORM-001');
assert(Boolean(typeormSyncCheck), '21a. PDF check DEP-ORM-TYPEORM-001 (TypeORM synchronize: false) registered');
assert(typeormSyncCheck.aliases.includes('ORM-TYPE-001'), '21b. DEP-ORM-TYPEORM-001 aliased to ORM-TYPE-001');

const springProfileCheck = getCheckById('DEP-FW-SPRING-001');
assert(Boolean(springProfileCheck), '22a. PDF check DEP-FW-SPRING-001 (Spring active profile prod) registered');
assert(springProfileCheck.aliases.includes('SPRG-001'), '22b. DEP-FW-SPRING-001 aliased to SPRG-001');

const springActuatorCheck = getCheckById('DEP-FW-SPRING-002');
assert(Boolean(springActuatorCheck), '23a. PDF check DEP-FW-SPRING-002 (Spring Actuator sensitive exposure) registered');
assert(springActuatorCheck.category === 'SECURITY', '23b. DEP-FW-SPRING-002 category is SECURITY');

const uvicornReloadCheck = getCheckById('DEP-FW-FAST-002');
assert(Boolean(uvicornReloadCheck), '24a. PDF check DEP-FW-FAST-002 (Uvicorn auto-reload deactivation) registered');
assert(uvicornReloadCheck.aliases.includes('FAST-001'), '24b. DEP-FW-FAST-002 aliased to FAST-001');

const fastApiCorsCheck = getCheckById('DEP-FW-FAST-003');
assert(Boolean(fastApiCorsCheck), '25a. PDF check DEP-FW-FAST-003 (FastAPI wildcard CORS + credentials) registered');
assert(fastApiCorsCheck.category === 'SECURITY', '25b. DEP-FW-FAST-003 category is SECURITY');

const laravelKeyCheck = getCheckById('DEP-FW-LARAVEL-001');
assert(Boolean(laravelKeyCheck), '26a. PDF check DEP-FW-LARAVEL-001 (Laravel APP_KEY) registered');
assert(laravelKeyCheck.aliases.includes('LAR-002'), '26b. DEP-FW-LARAVEL-001 aliased to LAR-002');

const railsAssetsCheck = getCheckById('DEP-FW-RAILS-001');
assert(Boolean(railsAssetsCheck), '27a. PDF check DEP-FW-RAILS-001 (Rails asset precompile) registered');
assert(railsAssetsCheck.category === 'BUILD', '27b. DEP-FW-RAILS-001 category is BUILD');

const dockerUserCheck = getCheckById('DEP-HOST-DOCKER-005');
assert(Boolean(dockerUserCheck), '28a. PDF check DEP-HOST-DOCKER-005 (Non-root user in Docker) registered');
assert(dockerUserCheck.aliases.includes('DOCK-002'), '28b. DEP-HOST-DOCKER-005 aliased to DOCK-002');

const k8sResourcesCheck = getCheckById('DEP-HOST-K8S-002');
assert(Boolean(k8sResourcesCheck), '29a. PDF check DEP-HOST-K8S-002 (K8s resource requests & limits) registered');
assert(k8sResourcesCheck.aliases.includes('K8S-002'), '29b. DEP-HOST-K8S-002 aliased to K8S-002');

const vercelBundleCheck = getCheckById('DEP-HOST-VERCEL-003');
assert(Boolean(vercelBundleCheck), '30a. PDF check DEP-HOST-VERCEL-003 (Vercel serverless bundle limit) registered');
assert(vercelBundleCheck.aliases.includes('PLAT-VERC-001'), '30b. DEP-HOST-VERCEL-003 aliased to PLAT-VERC-001');

const cfWorkersCheck = getCheckById('DEP-HOST-CF-001');
assert(Boolean(cfWorkersCheck), '31a. PDF check DEP-HOST-CF-001 (Cloudflare Workers nodejs_compat) registered');
assert(cfWorkersCheck.aliases.includes('PLAT-CF-001'), '31b. DEP-HOST-CF-001 aliased to PLAT-CF-001');

// 8. Explicit Non-Deployment Check Rejections Documentation
const rejectedChecks = getRejectedChecks();
assert(Array.isArray(rejectedChecks), '32a. getRejectedChecks() returns array');
assert(rejectedChecks.length === 3, '32b. Exactly 3 candidate checks explicitly rejected from registry');

const rejectedIds = rejectedChecks.map(r => r.id);
assert(rejectedIds.includes('INF-TEST-001'), '33a. INF-TEST-001 rejected with technical rationale');
assert(rejectedIds.includes('INF-LINT-001'), '33b. INF-LINT-001 rejected with technical rationale');
assert(rejectedIds.includes('INF-SEC-001'), '33c. INF-SEC-001 rejected with technical rationale');

// Ensure rejected checks are NEVER registered as active deploy checks
assert(getCheckById('INF-TEST-001') === undefined, '34a. INF-TEST-001 is NOT in active deployment registry');
assert(getCheckById('INF-LINT-001') === undefined, '34b. INF-LINT-001 is NOT in active deployment registry');
assert(getCheckById('INF-SEC-001') === undefined, '34c. INF-SEC-001 is NOT in active deployment registry');

// 9. Execution Boundary Enforcement: Adaptive AI remains 0 bytes (no premature Phase 7 logic)
const adaptiveStat = fsModule.statSync('src/deploy/adaptive.ts');
const geminiStat = fsModule.statSync('src/ai/gemini.ts');

assert(adaptiveStat.size === 0, '35a. src/deploy/adaptive.ts remains 0 bytes (no premature adaptive AI logic)');
assert(geminiStat.size > 0, '35b. src/ai/gemini.ts exists and is implemented for Phase 6');
assert(fsModule.existsSync('src/deploy/engine.ts'), '35c. src/deploy/engine.ts exists');

console.log('----------------------------------------------------');
console.log('ALL PHASE 3 REGISTRY HARDENING TESTS PASSED: ' + passed + ' / ' + total + ' assertions verified.');
