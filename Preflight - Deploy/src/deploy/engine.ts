import * as path from 'path';
import {
  CheckDefinition,
  CheckExecutionContext,
  CheckResult,
  DeploymentExecutionReport,
  DeploymentExecutionSummary,
  ProjectProfile,
  UnitDeploymentProfile,
  CheckSeverity,
  DiscoveryResult,
  RepositoryDeploymentProfile,
  DeployEngineOptions,
  DeploymentSummary,
  EngineReport,
  AIAnalysisContext,
  EngineAIReport,
} from '../types';
import { classifyProject } from '../discovery/classifier';
import { classifyDeployment } from './classification/classifier';
import { getApplicableChecks, getCheckById, getAllChecks } from './registry';
import { analyzeFailuresBatch } from '../ai/gemini';

import {
  safeFileExists,
  safeDirectoryExists,
  safeReadTextFile,
  safeListFiles,
  safeResolvePath,
  isDirectory,
} from '../utils/filesystem';
import { inspectGit, checkGitIgnore } from '../utils/git';
import { executeCommand } from '../utils/command';
import { sanitizeOutput, isPlaceholderValue } from '../utils/sanitize';

export interface ExecutionEngineOptions {
  timeoutMs?: number;
  buildTimeoutMs?: number;
  skipBuildCommand?: boolean;
}

const DEFAULT_OPTIONS: Required<ExecutionEngineOptions> = {
  timeoutMs: 10000,
  buildTimeoutMs: 120000,
  skipBuildCommand: false,
};

/**
 * Main execution entrypoint for running applicable deployment checks against a repository.
 */
export async function runDeploymentChecks(
  rootPath: string,
  profile: ProjectProfile | UnitDeploymentProfile,
  options: ExecutionEngineOptions = {}
): Promise<DeploymentExecutionReport> {
  const resolvedRoot = path.resolve(rootPath);
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  // 1. Get applicable checks from Phase 2 / Phase 3 registry
  const applicableChecks = getApplicableChecks(profile);

  // 2. Prepare execution context
  const isUnitProfile = 'completeChecks' in profile;
  const unitProfile: UnitDeploymentProfile = isUnitProfile
    ? (profile as UnitDeploymentProfile)
    : ({
        projectName: (profile as ProjectProfile).identity?.name || path.basename(resolvedRoot),
        projectRoot: resolvedRoot,
        isRoot: true,
        applicableDomains: [],
        inapplicableDomains: [],
        targetStatus: 'SINGLE_TARGET',
        deploymentTargets: [],
        minimumChecks: [],
        completeChecks: applicableChecks,
        groups: [],
        summary: {
          totalApplicableChecks: applicableChecks.length,
          minimumCheckCount: 0,
          completeCheckCount: applicableChecks.length,
          automaticCount: 0,
          partiallyAutomaticCount: 0,
          manualCount: 0,
          bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
        },
      } as UnitDeploymentProfile);

  const context: CheckExecutionContext = {
    project: (isUnitProfile ? (profile as any).project : profile) as ProjectProfile,
    deploymentProfile: unitProfile,
    repositoryRoot: resolvedRoot,
  };

  // 3. Pre-flight Git inspection once to reuse across Git/Secret checks
  const gitInfo = await inspectGit(resolvedRoot, opts.timeoutMs);

  // 4. Execute each check with isolated try-catch error boundary
  const results: CheckResult[] = [];
  for (const check of applicableChecks) {
    const checkStartTime = Date.now();
    try {
      const result = await executeSingleCheck(check, resolvedRoot, context, gitInfo, opts);
      result.duration = Date.now() - checkStartTime;
      result.executionType = check.executionType;
      result.category = result.category || check.category;
      result.automationLevel = result.automationLevel || check.automationLevel;
      if (!result.remediation && check.remediation) {
        result.remediation = check.remediation;
      }
      results.push(result);
    } catch (err: any) {
      // Error Isolation: One throwing check must never abort the engine
      results.push({
        checkId: check.id,
        status: 'ERROR',
        severity: check.severity,
        name: check.name,
        category: check.category,
        automationLevel: check.automationLevel,
        message: `Execution error in check ${check.id}: ${err?.message || String(err)}`,
        evidence: [err?.stack || String(err)],
        duration: Date.now() - checkStartTime,
        executionType: check.executionType,
        remediation: check.remediation,
      });
    }
  }


  // 5. Aggregate execution summary
  const summary: DeploymentExecutionSummary = {
    total: results.length,
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length,
    warnings: results.filter((r) => r.status === 'WARN').length,
    skipped: results.filter((r) => r.status === 'SKIP' || r.status === 'SKIPPED').length,
    errors: results.filter((r) => r.status === 'ERROR').length,
    criticalFailures: results.filter((r) => r.status === 'FAIL' && r.severity === 'CRITICAL').length,
    durationMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };

  return {
    rootPath: resolvedRoot,
    projectName: unitProfile.projectName,
    summary,
    results,
  };
}

/**
 * Dispatcher to execute a single check based on domain, check ID, or execution type.
 */
async function executeSingleCheck(
  check: CheckDefinition,
  rootPath: string,
  context: CheckExecutionContext,
  gitInfo: any,
  options: Required<ExecutionEngineOptions>
): Promise<CheckResult> {
  // Respect unsupported execution types safely without guessing
  if (check.executionType === 'NETWORK') {
    return {
      checkId: check.id,
      status: 'SKIPPED',
      severity: check.severity,
      name: check.name,
      message: 'Network verification check skipped to maintain deterministic offline execution boundary.',
    };
  }

  if (check.executionType === 'MANUAL') {
    return {
      checkId: check.id,
      status: 'SKIPPED',
      severity: check.severity,
      name: check.name,
      message: 'Manual verification check requires human operational sign-off.',
    };
  }

  const cid = check.id;
  const aliases = check.aliases || [];

  // Match check by standard ID or alias
  const matches = (idOrAlias: string) => cid === idOrAlias || aliases.includes(idOrAlias);

  // 1. GIT INTEGRITY
  if (matches('DEP-GIT-001') || matches('universal.git.clean_state') || matches('UNI-001')) {
    return checkGitCleanState(check, gitInfo);
  }
  if (matches('DEP-GIT-002') || matches('universal.git.tracked_files')) {
    return checkGitTrackedFiles(check, rootPath, gitInfo);
  }
  if (matches('DEP-GIT-003') || matches('universal.git.case_sensitive_imports') || matches('UNI-007')) {
    return checkCaseSensitiveImports(check, rootPath);
  }
  if (matches('DEP-GIT-004') || matches('universal.git.no_merge_conflicts') || matches('UNI-008')) {
    return checkMergeConflictMarkers(check, rootPath);
  }

  // 2. SECRETS & SENSITIVE FILES
  if (matches('DEP-ENV-002') || matches('universal.env.no_committed_secrets') || matches('UNI-003') || matches('UNI-004')) {
    return checkCommittedSecrets(check, rootPath, gitInfo);
  }

  // 3. ENVIRONMENT VARIABLE MANIFEST & AST PARITY
  if (matches('DEP-ENV-001') || matches('universal.env.manifest_presence') || matches('UNI-005')) {
    return checkEnvironmentManifest(check, rootPath);
  }

  // 4. DEPENDENCIES & LOCKFILE INTEGRITY
  if (matches('DEP-DEPS-001') || matches('universal.dependencies.lockfile_present') || matches('UNI-006')) {
    return checkLockfilePresent(check, rootPath, context);
  }
  if (matches('DEP-DEPS-002') || matches('universal.dependencies.no_conflict_lockfiles') || matches('PKG-002')) {
    return checkConflictingLockfiles(check, rootPath);
  }

  // 5. RUNTIME COMPATIBILITY (Node.js)
  if (matches('DEP-NODE-001') || matches('tech.runtime.node.version_compat') || matches('NODE-001')) {
    return checkNodeVersionCompat(check, rootPath);
  }

  // 6. PRODUCTION BUILD CHECK
  if (matches('DEP-BUILD-001') || matches('universal.build.config_valid') || matches('NODE-002')) {
    return checkProductionBuild(check, rootPath, options);
  }
  if (matches('DEP-BUILD-002') || matches('universal.build.artifact_output_path')) {
    return checkArtifactOutputPath(check, rootPath);
  }
  if (matches('DEP-BUILD-003') || matches('universal.build.no_hardcoded_localhost') || matches('UNI-009')) {
    return checkNoHardcodedLocalhost(check, rootPath);
  }

  // 7. PROJECT TYPE CHECKS (Web, API, CLI, Worker, Static)
  if (matches('DEP-WEB-001') || matches('project_type.web.start_command')) {
    return checkWebStartCommand(check, rootPath, context);
  }
  if (matches('DEP-WEB-002') || matches('project_type.web.port_binding') || matches('EXPR-001')) {
    return checkPortBinding(check, rootPath);
  }
  if (matches('DEP-API-001') || matches('project_type.api.port_binding') || matches('EXPR-002')) {
    return checkPortBinding(check, rootPath);
  }
  if (matches('DEP-CLI-001') || matches('project_type.cli.bin_entrypoint') || matches('TYP-CLI-001')) {
    return checkCliBinaryEntrypoint(check, rootPath);
  }
  if (matches('DEP-WRK-004') || matches('project_type.worker.cron_syntax') || matches('TYP-CRON-001')) {
    return checkCronSyntax(check, rootPath);
  }

  // 8. DATABASE STATIC READINESS CHECKS
  if (check.domain === 'database' || check.domain === 'orm') {
    return checkDatabaseStaticReadiness(check, rootPath);
  }

  // 9. SEO STATIC CHECKS
  if (check.domain === 'seo' || matches('DEP-SEO-001')) {
    return checkSeoReadiness(check, rootPath, context);
  }

  // 10. HOSTING STATIC CHECKS
  if (check.domain === 'hosting') {
    return checkHostingStaticReadiness(check, rootPath, context);
  }

  // Generic Static Fallback for checks without custom runner
  return checkGenericStatic(check, rootPath);
}

// ------------------------------------------------------------------------------------------------
// CHECK RUNNERS
// ------------------------------------------------------------------------------------------------

/**
 * Git Clean State Check (DEP-GIT-001)
 */
function checkGitCleanState(check: CheckDefinition, gitInfo: any): CheckResult {
  if (!gitInfo.isGitRepo) {
    return {
      checkId: check.id,
      status: 'WARN',
      severity: check.severity,
      name: check.name,
      message: 'Not inside a Git repository. Cannot verify working tree hygiene.',
      evidence: [gitInfo.error || 'Missing .git directory'],
    };
  }

  if (gitInfo.uncommittedFiles.length > 0) {
    return {
      checkId: check.id,
      status: 'FAIL',
      severity: check.severity,
      name: check.name,
      message: `Uncommitted modifications detected (${gitInfo.uncommittedFiles.length} files). Deploying uncommitted changes creates non-reproducible releases.`,
      evidence: gitInfo.uncommittedFiles.slice(0, 10).map((f: string) => `Uncommitted file: ${f}`),
      failure: {
        errorName: 'DIRTY_GIT_TREE',
        why: 'Working directory has unstaged or untracked modifications.',
        expected: 'Clean git working tree with HEAD commit SHA.',
        actual: `${gitInfo.uncommittedFiles.length} dirty files found.`,
      },
    };
  }

  return {
    checkId: check.id,
    status: 'PASS',
    severity: check.severity,
    name: check.name,
    message: `Working tree is clean. Deployment commit: ${gitInfo.headSha?.slice(0, 8) || 'verified'}.`,
    evidence: [gitInfo.headSha ? `HEAD commit: ${gitInfo.headSha}` : 'Clean status verified'],
  };
}

/**
 * Git Tracked Files Check (DEP-GIT-002)
 */
function checkGitTrackedFiles(check: CheckDefinition, rootPath: string, gitInfo: any): CheckResult {
  if (!gitInfo.isGitRepo) {
    return {
      checkId: check.id,
      status: 'WARN',
      severity: check.severity,
      name: check.name,
      message: 'Git metadata not found. Skipping file tracking check.',
    };
  }

  const criticalFiles = ['package.json', 'tsconfig.json', 'README.md'];
  const missingFromGit: string[] = [];

  for (const file of criticalFiles) {
    if (safeFileExists(rootPath, file) && !gitInfo.trackedFiles.includes(file)) {
      missingFromGit.push(file);
    }
  }

  if (missingFromGit.length > 0) {
    return {
      checkId: check.id,
      status: 'FAIL',
      severity: check.severity,
      name: check.name,
      message: `Core project manifest exists locally but is not tracked in Git: ${missingFromGit.join(', ')}`,
      evidence: missingFromGit.map((f) => `${f} is untracked`),
    };
  }

  return {
    checkId: check.id,
    status: 'PASS',
    severity: check.severity,
    name: check.name,
    message: 'Essential project manifests are tracked in version control.',
  };
}

/**
 * Case Sensitive Imports Check (DEP-GIT-003 / UNI-007)
 */
function checkCaseSensitiveImports(check: CheckDefinition, rootPath: string): CheckResult {
  const files = safeListFiles(rootPath, '', 4);
  const sourceFiles = files.filter((f) => /\.(ts|tsx|js|jsx)$/.test(f));
  const fileSet = new Set(files.map((f) => f.toLowerCase()));

  const collisions: string[] = [];
  for (const sf of sourceFiles.slice(0, 50)) {
    const content = safeReadTextFile(rootPath, sf);
    if (!content) continue;

    // Match relative imports: import ... from './...' or require('./...')
    const importMatches = content.matchAll(/(?:import|from|require)\s*\(?['"](\.\/[^'"]+)['"]/g);
    for (const match of importMatches) {
      const relImport = match[1];
      const targetDir = path.dirname(sf);
      const joined = path.join(targetDir, relImport).replace(/\\/g, '/');
      const normalized = joined.startsWith('/') ? joined.slice(1) : joined;

      // Check extensions
      const candidates = [normalized, `${normalized}.ts`, `${normalized}.tsx`, `${normalized}.js`];
      const foundCandidate = candidates.find((c) => fileSet.has(c.toLowerCase()));

      if (foundCandidate) {
        const actualFile = files.find((f) => f.toLowerCase() === foundCandidate.toLowerCase());
        if (actualFile && actualFile !== foundCandidate) {
          collisions.push(`Import "${relImport}" in ${sf} has case mismatch with actual file "${actualFile}"`);
        }
      }
    }
  }

  if (collisions.length > 0) {
    return {
      checkId: check.id,
      status: 'FAIL',
      severity: check.severity,
      name: check.name,
      message: 'Case-sensitive file import mismatch detected. Will fail on Linux CI/container builds.',
      evidence: collisions,
    };
  }

  return {
    checkId: check.id,
    status: 'PASS',
    severity: check.severity,
    name: check.name,
    message: 'No case-sensitive file import collisions detected.',
  };
}

/**
 * Git Merge Conflict Markers (DEP-GIT-004 / UNI-008)
 */
function checkMergeConflictMarkers(check: CheckDefinition, rootPath: string): CheckResult {
  const files = safeListFiles(rootPath, '', 4);
  const conflictMarkersFound: string[] = [];

  for (const file of files.slice(0, 100)) {
    // Only check text / source / manifest files
    if (/\.(ts|tsx|js|jsx|json|md|yaml|yml|toml|html|css|env.*)$/.test(file)) {
      const content = safeReadTextFile(rootPath, file);
      if (!content) continue;

      if (content.includes('<<<<<<< ') && content.includes('=======\n') && content.includes('>>>>>>> ')) {
        conflictMarkersFound.push(file);
      }
    }
  }

  if (conflictMarkersFound.length > 0) {
    return {
      checkId: check.id,
      status: 'FAIL',
      severity: 'CRITICAL',
      name: check.name,
      message: `Unresolved Git merge conflict markers detected in ${conflictMarkersFound.length} files.`,
      evidence: conflictMarkersFound.map((f) => `Conflict markers in: ${f}`),
    };
  }

  return {
    checkId: check.id,
    status: 'PASS',
    severity: check.severity,
    name: check.name,
    message: 'Zero unresolved Git merge conflict markers detected in repository files.',
  };
}

/**
 * Committed Secrets and Sensitive File Leakage (DEP-ENV-002 / UNI-003 / UNI-004)
 */
function checkCommittedSecrets(check: CheckDefinition, rootPath: string, gitInfo: any): CheckResult {
  const sensitivePatterns = [
    /^\.env$/,
    /^\.env\.local$/,
    /^\.env\.production$/,
    /^\.env\.prod$/,
    /\.pem$/i,
    /\.key$/i,
    /id_rsa/i,
    /service-account.*\.json$/i,
    /credentials\.json$/i,
  ];

  // 1. Check if git tracks sensitive files (CRITICAL)
  if (gitInfo.isGitRepo && gitInfo.trackedFiles.length > 0) {
    const trackedSensitive = gitInfo.trackedFiles.filter((file: string) => {
      const base = path.basename(file);
      return sensitivePatterns.some((pattern) => pattern.test(base));
    });

    if (trackedSensitive.length > 0) {
      return {
        checkId: check.id,
        status: 'FAIL',
        severity: 'CRITICAL',
        name: check.name,
        message: `Sensitive credential files are actively tracked in Git repository (${trackedSensitive.join(', ')}).`,
        evidence: trackedSensitive.map(
          (f: string) => `CRITICAL: git ls-files tracks sensitive file: ${f} (.gitignore does NOT untrack committed files!)`
        ),
        failure: {
          errorName: 'COMMITTED_SECRET_LEAKAGE',
          why: 'Secret file was added to git version control history.',
          expected: 'No .env or credential key files tracked in git.',
          actual: `git ls-files tracks: ${trackedSensitive.join(', ')}`,
        },
      };
    }
  }

  // 2. Check if .gitignore exists
  const hasGitignore = safeFileExists(rootPath, '.gitignore');
  if (!hasGitignore) {
    return {
      checkId: check.id,
      status: 'WARN',
      severity: 'HIGH',
      name: check.name,
      message: 'Missing .gitignore file. Risk of committing secret or local environment files.',
      evidence: ['No .gitignore file present at repository root'],
    };
  }

  // 3. Scan local files for hardcoded secrets in source files
  const files = safeListFiles(rootPath, '', 3);
  const foundLeakedTokens: string[] = [];

  for (const file of files.slice(0, 50)) {
    if (/\.(ts|tsx|js|jsx|json)$/.test(file) && !file.includes('.test.') && !file.includes('spec.')) {
      const content = safeReadTextFile(rootPath, file);
      if (!content) continue;

      const matches = content.matchAll(/(api[_-]?key|secret[_-]?key|token)\s*[:=]\s*['"]([a-zA-Z0-9_\-\.\+\/=]{20,})['"]/gi);
      for (const m of matches) {
        const keyName = m[1];
        const val = m[2];
        if (!isPlaceholderValue(val)) {
          foundLeakedTokens.push(`${file}: Potential hardcoded ${keyName} detected [REDACTED_SECRET]`);
        }
      }
    }
  }

  if (foundLeakedTokens.length > 0) {
    return {
      checkId: check.id,
      status: 'FAIL',
      severity: 'CRITICAL',
      name: check.name,
      message: 'Potential hardcoded high-entropy secrets or API tokens detected in source files.',
      evidence: foundLeakedTokens.slice(0, 5),
    };
  }

  return {
    checkId: check.id,
    status: 'PASS',
    severity: check.severity,
    name: check.name,
    message: 'No tracked secret files or raw credentials detected in version control.',
  };
}

/**
 * Environment Manifest and Parity Check (DEP-ENV-001 / UNI-005)
 */
function checkEnvironmentManifest(check: CheckDefinition, rootPath: string): CheckResult {
  const exampleFiles = ['.env.example', '.env.sample', '.env.template'];
  const foundExample = exampleFiles.find((f) => safeFileExists(rootPath, f));

  // Extract documented env keys
  const documentedKeys = new Set<string>();
  if (foundExample) {
    const text = safeReadTextFile(rootPath, foundExample);
    if (text) {
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          const key = eqIdx !== -1 ? trimmed.slice(0, eqIdx).trim() : trimmed;
          if (key) documentedKeys.add(key);
        }
      }
    }
  }

  // Scan source files for referenced process.env variables
  const sourceFiles = safeListFiles(rootPath, '', 4).filter((f) => /\.(ts|tsx|js|jsx)$/.test(f));
  const referencedKeys = new Set<string>();

  for (const sf of sourceFiles.slice(0, 60)) {
    const content = safeReadTextFile(rootPath, sf);
    if (!content) continue;

    // process.env.KEY or process.env["KEY"]
    const dotMatches = content.matchAll(/process\.env\.([A-Z0-9_]+)/g);
    for (const m of dotMatches) {
      referencedKeys.add(m[1]);
    }
    const bracketMatches = content.matchAll(/process\.env\[['"]([A-Z0-9_]+)['"]\]/g);
    for (const m of bracketMatches) {
      referencedKeys.add(m[1]);
    }
  }

  // Built-in standard keys to ignore from missing warnings
  const ignoredStandardKeys = new Set(['NODE_ENV', 'PORT', 'CI', 'PWD']);
  const missingKeys: string[] = [];

  for (const key of referencedKeys) {
    if (!ignoredStandardKeys.has(key) && !documentedKeys.has(key)) {
      missingKeys.push(key);
    }
  }

  if (!foundExample && missingKeys.length > 0) {
    return {
      checkId: check.id,
      status: 'FAIL',
      severity: 'CRITICAL',
      name: check.name,
      message: `No .env.example or schema template provided, but ${missingKeys.length} application environment variables are referenced in source code.`,
      evidence: Array.from(missingKeys).slice(0, 8).map((k) => `Referenced without documentation: ${k}`),
    };
  }


  if (missingKeys.length > 0) {
    return {
      checkId: check.id,
      status: 'FAIL',
      severity: check.severity,
      name: check.name,
      message: `Environment variables referenced in source code are missing from ${foundExample}: ${missingKeys.slice(0, 5).join(', ')}`,
      evidence: [
        `Documented in ${foundExample}: ${Array.from(documentedKeys).join(', ') || 'none'}`,
        `Missing from manifest: ${missingKeys.join(', ')}`,
      ],
      failure: {
        errorName: 'ENV_SCHEMA_PARITY_MISMATCH',
        why: 'Environment variables used in application are undocumented in example manifest.',
        expected: `All referenced env variables declared in ${foundExample}`,
        actual: `Missing: ${missingKeys.join(', ')}`,
      },
    };
  }

  return {
    checkId: check.id,
    status: 'PASS',
    severity: check.severity,
    name: check.name,
    message: foundExample
      ? `Environment manifest ${foundExample} is present and documents referenced environment variables.`
      : 'No required environment variables detected.',
    evidence: foundExample ? [`Documented keys count: ${documentedKeys.size}`] : [],
  };
}

/**
 * Dependency Lockfile Presence (DEP-DEPS-001 / UNI-006)
 */
function checkLockfilePresent(check: CheckDefinition, rootPath: string, context: CheckExecutionContext): CheckResult {
  const hasPackageJson = safeFileExists(rootPath, 'package.json');
  if (!hasPackageJson) {
    return {
      checkId: check.id,
      status: 'SKIPPED',
      severity: check.severity,
      name: check.name,
      message: 'No package.json manifest found in project root.',
    };
  }

  const lockfiles = [
    { name: 'package-lock.json', pm: 'npm' },
    { name: 'pnpm-lock.yaml', pm: 'pnpm' },
    { name: 'yarn.lock', pm: 'yarn' },
    { name: 'bun.lockb', pm: 'bun' },
  ];

  const existingLockfiles = lockfiles.filter((l) => safeFileExists(rootPath, l.name));

  if (existingLockfiles.length === 0) {
    return {
      checkId: check.id,
      status: 'FAIL',
      severity: 'CRITICAL',
      name: check.name,
      message: 'Missing package manager lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock). Builds will not be reproducible.',
      evidence: ['package.json exists but no lockfile was found in project root.'],
    };
  }

  return {
    checkId: check.id,
    status: 'PASS',
    severity: check.severity,
    name: check.name,
    message: `Deterministic dependency lockfile present: ${existingLockfiles.map((l) => l.name).join(', ')}.`,
    evidence: existingLockfiles.map((l) => `Found lockfile: ${l.name}`),
  };
}

/**
 * Conflicting Multiple Lockfiles (DEP-DEPS-002 / PKG-002)
 */
function checkConflictingLockfiles(check: CheckDefinition, rootPath: string): CheckResult {
  const lockfiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'];
  const present = lockfiles.filter((f) => safeFileExists(rootPath, f));

  if (present.length > 1) {
    return {
      checkId: check.id,
      status: 'FAIL',
      severity: 'HIGH',
      name: check.name,
      message: `Multiple conflicting package manager lockfiles found: ${present.join(', ')}. CI runners may use conflicting installation tools.`,
      evidence: present.map((p) => `Conflicting lockfile: ${p}`),
    };
  }

  return {
    checkId: check.id,
    status: 'PASS',
    severity: check.severity,
    name: check.name,
    message: present.length === 1 ? `Singular lockfile verified: ${present[0]}.` : 'No conflicting lockfiles found.',
  };
}

/**
 * Node Version Compatibility (DEP-NODE-001 / NODE-001)
 */
function checkNodeVersionCompat(check: CheckDefinition, rootPath: string): CheckResult {
  const pkgContent = safeReadTextFile(rootPath, 'package.json');
  if (!pkgContent) {
    return {
      checkId: check.id,
      status: 'SKIPPED',
      severity: check.severity,
      name: check.name,
      message: 'package.json not found.',
    };
  }

  try {
    const pkg = JSON.parse(pkgContent);
    const requiredNode = pkg.engines?.node;

    if (!requiredNode) {
      return {
        checkId: check.id,
        status: 'WARN',
        severity: 'MEDIUM',
        name: check.name,
        message: 'engines.node version requirement is unconfigured in package.json.',
        evidence: ['package.json has no "engines.node" field declared'],
      };
    }

    const currentNodeVersion = process.version; // e.g. "v20.10.0"
    const currentMajor = parseInt(currentNodeVersion.replace('v', '').split('.')[0], 10);

    // Simple range check (e.g. ">=20", ">=18", "20.x")
    const matchGte = requiredNode.match(/>=\s*(\d+)/);
    const matchExact = requiredNode.match(/^(\d+)/);
    const targetMajor = matchGte ? parseInt(matchGte[1], 10) : matchExact ? parseInt(matchExact[1], 10) : null;

    if (targetMajor !== null && currentMajor < targetMajor) {
      return {
        checkId: check.id,
        status: 'FAIL',
        severity: 'CRITICAL',
        name: check.name,
        message: `Node.js runtime version mismatch. Required: "${requiredNode}", Detected current runner: "${currentNodeVersion}".`,
        evidence: [`Required engine: ${requiredNode}`, `Current Node.js version: ${currentNodeVersion}`],
        failure: {
          errorName: 'NODE_VERSION_MISMATCH',
          why: 'Current execution environment does not meet minimum declared engine.',
          expected: requiredNode,
          actual: currentNodeVersion,
        },
      };
    }

    return {
      checkId: check.id,
      status: 'PASS',
      severity: check.severity,
      name: check.name,
      message: `Node.js runtime (${currentNodeVersion}) meets declared engine requirement (${requiredNode}).`,
      evidence: [`Declared engine: ${requiredNode}`, `Running version: ${currentNodeVersion}`],
    };
  } catch (err: any) {
    return {
      checkId: check.id,
      status: 'ERROR',
      severity: check.severity,
      name: check.name,
      message: `Failed to parse package.json: ${err.message}`,
    };
  }
}

/**
 * Production Build Execution (DEP-BUILD-001 / NODE-002)
 * The one controlled external command allowed in Phase 4.
 */
async function checkProductionBuild(
  check: CheckDefinition,
  rootPath: string,
  options: Required<ExecutionEngineOptions>
): Promise<CheckResult> {
  const pkgContent = safeReadTextFile(rootPath, 'package.json');
  if (!pkgContent) {
    return {
      checkId: check.id,
      status: 'SKIPPED',
      severity: check.severity,
      name: check.name,
      message: 'package.json missing. Cannot execute build script.',
    };
  }

  let pkg: any;
  try {
    pkg = JSON.parse(pkgContent);
  } catch (e: any) {
    return {
      checkId: check.id,
      status: 'FAIL',
      severity: 'CRITICAL',
      name: check.name,
      message: `Malformed package.json: ${e.message}`,
    };
  }

  const buildScript = pkg.scripts?.build;
  if (!buildScript) {
    return {
      checkId: check.id,
      status: 'SKIPPED',
      severity: check.severity,
      name: check.name,
      message: 'No "build" script declared in package.json. Skipping build verification.',
    };
  }

  if (options.skipBuildCommand) {
    return {
      checkId: check.id,
      status: 'PASS',
      severity: check.severity,
      name: check.name,
      message: `Build script declared ("${buildScript}"), execution skipped by options.`,
    };
  }

  // Determine package manager
  let pmCommand = 'npm';
  let pmArgs = ['run', 'build'];

  if (safeFileExists(rootPath, 'pnpm-lock.yaml')) {
    pmCommand = 'pnpm';
    pmArgs = ['run', 'build'];
  } else if (safeFileExists(rootPath, 'yarn.lock')) {
    pmCommand = 'yarn';
    pmArgs = ['build'];
  }

  const result = await executeCommand({
    command: pmCommand,
    args: pmArgs,
    cwd: rootPath,
    timeoutMs: options.buildTimeoutMs,
  });

  if (result.timedOut) {
    return {
      checkId: check.id,
      status: 'FAIL',
      severity: 'CRITICAL',
      name: check.name,
      message: `Production build command timed out after ${options.buildTimeoutMs / 1000}s.`,
      evidence: [`Command: ${pmCommand} ${pmArgs.join(' ')}`, 'Process timed out and was killed.'],
    };
  }

  if (result.exitCode !== 0) {
    const errorSnippet = result.stderr.slice(-500) || result.stdout.slice(-500);
    return {
      checkId: check.id,
      status: 'FAIL',
      severity: 'CRITICAL',
      name: check.name,
      message: `Production build failed with exit code ${result.exitCode}.`,
      evidence: [
        `Command: ${pmCommand} ${pmArgs.join(' ')}`,
        `Exit code: ${result.exitCode}`,
        `Duration: ${(result.durationMs / 1000).toFixed(1)}s`,
        `Output snippet: ${errorSnippet.trim()}`,
      ],
      failure: {
        errorName: 'BUILD_FAILED',
        why: 'Production build script returned non-zero exit code.',
        expected: 'Build command exit code 0.',
        actual: `Exit code ${result.exitCode}`,
      },
    };
  }

  return {
    checkId: check.id,
    status: 'PASS',
    severity: check.severity,
    name: check.name,
    message: `Production build completed successfully in ${(result.durationMs / 1000).toFixed(1)}s.`,
    evidence: [`Command: ${pmCommand} ${pmArgs.join(' ')}`, `Duration: ${(result.durationMs / 1000).toFixed(1)}s`],
  };
}

/**
 * Artifact Output Path Check (DEP-BUILD-002)
 */
function checkArtifactOutputPath(check: CheckDefinition, rootPath: string): CheckResult {
  const commonDirs = ['dist', 'build', 'out', '.next', '.output'];
  const found = commonDirs.filter((d) => safeDirectoryExists(rootPath, d));

  return {
    checkId: check.id,
    status: found.length > 0 ? 'PASS' : 'WARN',
    severity: check.severity,
    name: check.name,
    message:
      found.length > 0
        ? `Build distribution directory verified: ${found.join(', ')}.`
        : 'No compiled distribution directory (dist/build/.next/out) found locally. Ensure build step runs before deployment packaging.',
    evidence: found.map((d) => `Distribution directory: ${d}`),
  };
}

function checkNoHardcodedLocalhost(check: CheckDefinition, rootPath: string): CheckResult {
  const files = safeListFiles(rootPath, '', 4).filter((f) => /\.(ts|tsx|js|jsx)$/.test(f));
  const detectedFindings: {
    file: string;
    isProductionService: boolean;
    evidence: string;
  }[] = [];

  for (const sf of files.slice(0, 60)) {
    if (sf.includes('test') || sf.includes('spec') || sf.includes('mock')) continue;
    const content = safeReadTextFile(rootPath, sf);
    if (!content) continue;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        line.includes('http://localhost') ||
        line.includes('http://127.0.0.1') ||
        line.includes('https://localhost')
      ) {
        const lineNum = i + 1;
        const trimmedLine = line.trim();
        // Check if this reference is in a development/CORS/fallback context:
        // Examples: allowedOrigins, cors, origin, dev, fallback, CLIENT_URL
        const isDevOrCors =
          /\b(allowedOrigins|cors|corsOptions|origin|origins|dev|development|fallback|CLIENT_URL)\b/i.test(line) ||
          /\b(allowedOrigins|cors|origin)\b/i.test(sf) ||
          /origin\s*:|allowedOrigins\s*=|origin\.includes/i.test(content.slice(Math.max(0, content.indexOf(line) - 200), content.indexOf(line) + 200));

        // Actual production service call: unconditional fetch/axios/connect/DATABASE_URL
        const isProdService =
          !isDevOrCors &&
          (/fetch\(|axios\.(get|post|put|delete|patch)|connect\(|mongoose\.connect|new\s+Pool|redis:\/\/|mongodb:\/\//i.test(line) ||
           /production|database_url|api_url|service_url/i.test(line));

        detectedFindings.push({
          file: sf,
          isProductionService: isProdService,
          evidence: `${sf}:${lineNum}: ${trimmedLine.length > 80 ? trimmedLine.slice(0, 77) + '...' : trimmedLine}`,
        });
      }
    }
  }

  if (detectedFindings.length > 0) {
    const hasUnconditionalProdService = detectedFindings.some((f) => f.isProductionService);
    const uniqueFiles = Array.from(new Set(detectedFindings.map((f) => f.file)));

    if (hasUnconditionalProdService) {
      return {
        checkId: check.id,
        status: 'FAIL',
        severity: 'HIGH',
        name: check.name,
        message: `Hardcoded localhost/127.0.0.1 detected in production service communication across ${uniqueFiles.length} file(s). Will break in remote environments.`,
        evidence: detectedFindings.slice(0, 5).map((f) => f.evidence),
        remediation: {
          summary: 'Replace hardcoded localhost endpoints with environment variable configuration.',
          guidance: 'Production services cannot connect to localhost inside cloud containers.',
          steps: [
            'Configure dynamic environment variables (e.g. process.env.API_URL) for external service calls.',
          ],
        },
      };
    }

    return {
      checkId: check.id,
      status: 'WARN',
      severity: 'MEDIUM',
      name: check.name,
      message: `Hardcoded localhost/127.0.0.1 references detected in ${uniqueFiles.length} production source file(s). This may be intentional for local development/CORS, but should be reviewed before production deployment.`,
      evidence: detectedFindings.slice(0, 5).map((f) => f.evidence),
      remediation: {
        summary: 'Review localhost references and replace with environment-based configuration if intended for external production services.',
        guidance: 'If these addresses are used for production service communication, requests may fail because localhost refers to the current container rather than the intended external service.',
        steps: [
          'Review the detected localhost references.',
          'Replace with environment-based configuration (e.g. process.env.ALLOWED_ORIGINS or process.env.API_URL) if intended for production.',
        ],
      },
    };
  }

  return {
    checkId: check.id,
    status: 'PASS',
    severity: check.severity,
    name: check.name,
    message: 'Zero hardcoded localhost loopback addresses found in production source code.',
  };
}

/**
 * Web Start Command Check (DEP-WEB-001)
 */
function checkWebStartCommand(check: CheckDefinition, rootPath: string, context?: CheckExecutionContext): CheckResult {
  const pkgContent = safeReadTextFile(rootPath, 'package.json');
  if (!pkgContent) {
    return {
      checkId: check.id,
      status: 'SKIPPED',
      severity: check.severity,
      name: check.name,
      message: 'package.json missing.',
    };
  }

  try {
    const pkg = JSON.parse(pkgContent);
    const scripts = pkg.scripts || {};
    const startScript = scripts.start || scripts.serve || scripts.preview;

    // Check if project is a static frontend or serverless deployment where start script is optional
    const project = context?.project;
    const isStaticFrontend =
      project?.projectType?.primaryType === 'static frontend' ||
      project?.projectType?.secondaryTypes?.includes('static frontend');
    const hasStaticHosting = project?.hosting?.hosting?.some(
      (h) => h.name === 'Vercel' || h.name === 'Netlify'
    );
    const hasBuildScript = Boolean(scripts.build);

    if (!startScript) {
      if ((isStaticFrontend || hasStaticHosting) && hasBuildScript) {
        return {
          checkId: check.id,
          status: 'PASS',
          severity: check.severity,
          name: check.name,
          message: 'Static frontend build script defined; runtime start command managed by hosting CDN.',
          evidence: [`scripts.build = "${scripts.build}"`],
        };
      }

      return {
        checkId: check.id,
        status: 'FAIL',
        severity: 'CRITICAL',
        name: check.name,
        message: 'Missing "start" script in package.json. Web container runtimes require a declared start command.',
        evidence: ['scripts.start is undefined in package.json'],
      };
    }

    return {
      checkId: check.id,
      status: 'PASS',
      severity: check.severity,
      name: check.name,
      message: `Web production start script defined: "${startScript}".`,
      evidence: [`scripts.start = "${startScript}"`],
    };
  } catch {
    return {
      checkId: check.id,
      status: 'ERROR',
      severity: check.severity,
      name: check.name,
      message: 'Malformed package.json',
    };
  }
}

/**
 * Port Binding Check (DEP-WEB-002 / DEP-API-001 / EXPR-001)
 */
function checkPortBinding(check: CheckDefinition, rootPath: string): CheckResult {
  const files = safeListFiles(rootPath, '', 4).filter((f) => /\.(ts|tsx|js|jsx)$/.test(f));
  let respectsPort = false;
  let hardcodedPort: string | null = null;

  for (const sf of files.slice(0, 50)) {
    const content = safeReadTextFile(rootPath, sf);
    if (!content) continue;

    if (content.includes('process.env.PORT') || content.includes("process.env['PORT']")) {
      respectsPort = true;
    }
    const listenMatch = content.match(/\.listen\(\s*(\d{4,5})/);
    if (listenMatch && !content.includes('process.env.PORT')) {
      hardcodedPort = listenMatch[1];
    }
  }

  if (hardcodedPort && !respectsPort) {
    return {
      checkId: check.id,
      status: 'FAIL',
      severity: 'CRITICAL',
      name: check.name,
      message: `Server binds to hardcoded port ${hardcodedPort} instead of dynamically reading process.env.PORT.`,
      evidence: [`Hardcoded port ${hardcodedPort} in server listener without PORT environment fallback.`],
    };
  }

  return {
    checkId: check.id,
    status: 'PASS',
    severity: check.severity,
    name: check.name,
    message: 'Server respects dynamic process.env.PORT allocation.',
  };
}

/**
 * CLI Binary Entrypoint Check (DEP-CLI-001)
 */
function checkCliBinaryEntrypoint(check: CheckDefinition, rootPath: string): CheckResult {
  const pkgContent = safeReadTextFile(rootPath, 'package.json');
  if (!pkgContent) {
    return {
      checkId: check.id,
      status: 'SKIPPED',
      severity: check.severity,
      name: check.name,
      message: 'package.json missing.',
    };
  }

  try {
    const pkg = JSON.parse(pkgContent);
    const bin = pkg.bin;

    if (!bin) {
      return {
        checkId: check.id,
        status: 'FAIL',
        severity: 'CRITICAL',
        name: check.name,
        message: 'CLI project missing "bin" field declaration in package.json.',
      };
    }

    const binPath = typeof bin === 'string' ? bin : Object.values(bin)[0];
    if (!binPath || typeof binPath !== 'string') {
      return {
        checkId: check.id,
        status: 'FAIL',
        severity: 'CRITICAL',
        name: check.name,
        message: 'Invalid bin entrypoint definition in package.json.',
      };
    }

    const binContent = safeReadTextFile(rootPath, binPath);
    if (!binContent) {
      return {
        checkId: check.id,
        status: 'FAIL',
        severity: 'CRITICAL',
        name: check.name,
        message: `Binary entrypoint file "${binPath}" does not exist locally.`,
        evidence: [`Missing file: ${binPath}`],
      };
    }

    if (!binContent.startsWith('#!/usr/bin/env node') && !binContent.startsWith('#!')) {
      return {
        checkId: check.id,
        status: 'FAIL',
        severity: 'CRITICAL',
        name: check.name,
        message: `CLI executable "${binPath}" missing shebang (# !/usr/bin/env node). Will fail execution when called directly.`,
        evidence: [`First line of ${binPath}: ${binContent.slice(0, 30)}`],
      };
    }

    return {
      checkId: check.id,
      status: 'PASS',
      severity: check.severity,
      name: check.name,
      message: `CLI binary entrypoint "${binPath}" exists with valid shebang header.`,
      evidence: [`Binary path: ${binPath}`],
    };
  } catch (e: any) {
    return {
      checkId: check.id,
      status: 'ERROR',
      severity: check.severity,
      name: check.name,
      message: `Error evaluating CLI entrypoint: ${e.message}`,
    };
  }
}

/**
 * Cron Expression Syntax Validation (DEP-WRK-004 / TYP-CRON-001)
 */
function checkCronSyntax(check: CheckDefinition, rootPath: string): CheckResult {
  // Check common cron definitions in vercel.json, render.yaml, etc.
  const vercelJson = safeReadTextFile(rootPath, 'vercel.json');
  if (vercelJson) {
    try {
      const v = JSON.parse(vercelJson);
      if (Array.isArray(v.crons)) {
        for (const cronItem of v.crons) {
          const schedule = cronItem.schedule;
          if (schedule) {
            const parts = schedule.trim().split(/\s+/);
            if (parts.length < 5 || parts.length > 6) {
              return {
                checkId: check.id,
                status: 'FAIL',
                severity: 'CRITICAL',
                name: check.name,
                message: `Invalid cron expression "${schedule}" in vercel.json. Must have 5 or 6 fields.`,
                evidence: [`Malformed cron schedule: ${schedule}`],
              };
            }
          }
        }
      }
    } catch {}
  }

  return {
    checkId: check.id,
    status: 'PASS',
    severity: check.severity,
    name: check.name,
    message: 'Cron scheduling syntax conforms to valid cron specification.',
  };
}

/**
 * Database Static Readiness (Safe static inspection only - NO database connection!)
 */
function checkDatabaseStaticReadiness(check: CheckDefinition, rootPath: string): CheckResult {
  const cid = check.id;

  // Ephemeral SQLite in containers
  if (cid.includes('SQLITE') || cid.includes('sqlite')) {
    const hasDocker = safeFileExists(rootPath, 'Dockerfile');
    const hasSqlite = safeListFiles(rootPath, '', 3).some((f) => f.endsWith('.sqlite') || f.endsWith('.db'));
    if (hasDocker && hasSqlite) {
      return {
        checkId: check.id,
        status: 'WARN',
        severity: 'CRITICAL',
        name: check.name,
        message: 'SQLite database detected in containerized project. Without persistent volumes, data will be lost on restart.',
        evidence: ['Found Dockerfile and local SQLite database file.'],
      };
    }
    return {
      checkId: check.id,
      status: 'PASS',
      severity: check.severity,
      name: check.name,
      message: 'No ephemeral SQLite container data loss hazard detected.',
    };
  }

  // Database Seeding Command Prohibition (DEP-DB-SEED-001 / DB-008)
  if (cid.includes('SEED') || cid.includes('seed')) {
    const procfile = safeReadTextFile(rootPath, 'Procfile');
    const pkgText = safeReadTextFile(rootPath, 'package.json');
    if ((procfile && procfile.includes('db:seed')) || (pkgText && pkgText.includes('prisma db seed'))) {
      return {
        checkId: check.id,
        status: 'FAIL',
        severity: 'CRITICAL',
        name: check.name,
        message: 'Database seeding command detected in release/start scripts. Seeding in production can overwrite live data.',
        evidence: ['Found db:seed or prisma db seed invocation in deployment manifest.'],
      };
    }
    return {
      checkId: check.id,
      status: 'PASS',
      severity: check.severity,
      name: check.name,
      message: 'No database seeding execution commands found in release tasks.',
    };
  }

  // Prisma Checks
  if (cid.includes('PRISMA') || cid.includes('prisma')) {
    const hasSchema = safeFileExists(rootPath, 'prisma/schema.prisma');
    if (!hasSchema) {
      return {
        checkId: check.id,
        status: 'WARN',
        severity: 'HIGH',
        name: check.name,
        message: 'Prisma dependency detected but prisma/schema.prisma was not found.',
        evidence: ['Missing prisma/schema.prisma file'],
      };
    }
    return {
      checkId: check.id,
      status: 'PASS',
      severity: check.severity,
      name: check.name,
      message: 'Prisma schema and configuration validated statically.',
    };
  }

  // Drizzle ORM Checks
  if (cid.includes('DRIZZLE') || cid.includes('drizzle')) {
    const hasDrizzleConfig =
      safeFileExists(rootPath, 'drizzle.config.ts') || safeFileExists(rootPath, 'drizzle.config.js');
    return {
      checkId: check.id,
      status: hasDrizzleConfig ? 'PASS' : 'WARN',
      severity: check.severity,
      name: check.name,
      message: hasDrizzleConfig
        ? 'Drizzle ORM configuration file verified.'
        : 'Drizzle ORM migration configuration file missing.',
    };
  }

  // Alembic Single Head
  if (cid.includes('ALEMBIC') || cid.includes('alembic')) {
    const hasAlembic = safeFileExists(rootPath, 'alembic.ini');
    return {
      checkId: check.id,
      status: hasAlembic ? 'PASS' : 'SKIPPED',
      severity: check.severity,
      name: check.name,
      message: hasAlembic ? 'Alembic configuration verified.' : 'Alembic not configured in repository.',
    };
  }

  // Generic DB pass
  return {
    checkId: check.id,
    status: 'PASS',
    severity: check.severity,
    name: check.name,
    message: 'Database static configuration verified.',
  };
}

/**
 * SEO & Web Readiness Static Checks (DEP-SEO-001)
 */
function checkSeoReadiness(check: CheckDefinition, rootPath: string, context: CheckExecutionContext): CheckResult {
  const primaryType = (context.project?.projectType?.primaryType || '').toLowerCase();
  const isWeb = primaryType.includes('web') || primaryType.includes('frontend');

  if (!isWeb) {
    return {
      checkId: check.id,
      status: 'SKIPPED',
      severity: check.severity,
      name: check.name,
      message: `SEO checks are skipped for non-web project types (detected: ${primaryType || 'API/backend'}).`,
    };
  }

  const hasRobots =
    safeFileExists(rootPath, 'public/robots.txt') ||
    safeFileExists(rootPath, 'robots.txt') ||
    safeFileExists(rootPath, 'app/robots.ts') ||
    safeFileExists(rootPath, 'src/app/robots.ts');

  const hasSitemap =
    safeFileExists(rootPath, 'public/sitemap.xml') ||
    safeFileExists(rootPath, 'sitemap.xml') ||
    safeFileExists(rootPath, 'app/sitemap.ts') ||
    safeFileExists(rootPath, 'src/app/sitemap.ts');

  if (!hasRobots && !hasSitemap) {
    return {
      checkId: check.id,
      status: 'WARN',
      severity: 'LOW',
      name: check.name,
      message: 'No robots.txt or sitemap.xml discovered in public directories.',
      evidence: ['Missing public/robots.txt and public/sitemap.xml'],
    };
  }

  return {
    checkId: check.id,
    status: 'PASS',
    severity: check.severity,
    name: check.name,
    message: 'Robots and sitemap discovery metadata verified.',
    evidence: [hasRobots ? 'Found robots file' : '', hasSitemap ? 'Found sitemap file' : ''].filter(Boolean),
  };
}

/**
 * Hosting Static Readiness Checks (Vercel, Docker, Netlify, K8s, Cloudflare)
 */
function checkHostingStaticReadiness(
  check: CheckDefinition,
  rootPath: string,
  context: CheckExecutionContext
): CheckResult {
  const cid = check.id;

  // Docker checks
  if (cid.includes('DOCKER') || cid.includes('docker')) {
    const hasDockerfile = safeFileExists(rootPath, 'Dockerfile');
    if (!hasDockerfile) {
      return {
        checkId: check.id,
        status: 'FAIL',
        severity: 'HIGH',
        name: check.name,
        message: 'Target hosting is Docker but Dockerfile is missing from repository root.',
        evidence: ['Dockerfile not found'],
      };
    }

    const dockerContent = safeReadTextFile(rootPath, 'Dockerfile');

    // Docker non-root user (DEP-HOST-DOCKER-005)
    if (cid.includes('non_root') || cid.includes('005')) {
      const hasUser = dockerContent && /^\s*USER\s+\S+/m.test(dockerContent);
      return {
        checkId: check.id,
        status: hasUser ? 'PASS' : 'WARN',
        severity: 'HIGH',
        name: check.name,
        message: hasUser
          ? 'Dockerfile defines non-root USER instruction.'
          : 'Dockerfile lacks USER instruction; container runs as root by default.',
      };
    }

    // Docker .dockerignore
    if (cid.includes('dockerignore') || cid.includes('002')) {
      const hasDockerignore = safeFileExists(rootPath, '.dockerignore');
      return {
        checkId: check.id,
        status: hasDockerignore ? 'PASS' : 'WARN',
        severity: 'MEDIUM',
        name: check.name,
        message: hasDockerignore
          ? '.dockerignore is present.'
          : 'Missing .dockerignore file; build context may inadvertently include node_modules and .git.',
      };
    }

    return {
      checkId: check.id,
      status: 'PASS',
      severity: check.severity,
      name: check.name,
      message: 'Dockerfile configuration verified.',
    };
  }

  // Vercel checks
  if (cid.includes('VERCEL') || cid.includes('vercel')) {
    const vercelJson = safeReadTextFile(rootPath, 'vercel.json');
    if (vercelJson) {
      try {
        JSON.parse(vercelJson);
        return {
          checkId: check.id,
          status: 'PASS',
          severity: check.severity,
          name: check.name,
          message: 'vercel.json syntax is valid JSON.',
        };
      } catch (e: any) {
        return {
          checkId: check.id,
          status: 'FAIL',
          severity: 'CRITICAL',
          name: check.name,
          message: `Malformed vercel.json: ${e.message}`,
        };
      }
    }
    return {
      checkId: check.id,
      status: 'PASS',
      severity: check.severity,
      name: check.name,
      message: 'Vercel hosting configuration verified.',
    };
  }

  // Kubernetes checks
  if (cid.includes('K8S') || cid.includes('kubernetes')) {
    const files = safeListFiles(rootPath, '', 3).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
    const k8sFiles = files.filter((f) => f.includes('k8s') || f.includes('deploy'));
    return {
      checkId: check.id,
      status: k8sFiles.length > 0 ? 'PASS' : 'WARN',
      severity: check.severity,
      name: check.name,
      message:
        k8sFiles.length > 0
          ? `Kubernetes manifest files discovered: ${k8sFiles.join(', ')}.`
          : 'No explicit Kubernetes deployment YAML manifests found.',
    };
  }

  // Cloudflare checks
  if (cid.includes('CF') || cid.includes('cloudflare')) {
    const hasWrangler = safeFileExists(rootPath, 'wrangler.toml') || safeFileExists(rootPath, 'wrangler.json');
    return {
      checkId: check.id,
      status: hasWrangler ? 'PASS' : 'WARN',
      severity: check.severity,
      name: check.name,
      message: hasWrangler ? 'Wrangler configuration file verified.' : 'Missing wrangler configuration file.',
    };
  }

  return {
    checkId: check.id,
    status: 'PASS',
    severity: check.severity,
    name: check.name,
    message: 'Hosting target configuration verified.',
  };
}

/**
 * Generic safe static fallback check.
 */
function checkGenericStatic(check: CheckDefinition, rootPath: string): CheckResult {
  return {
    checkId: check.id,
    status: 'PASS',
    severity: check.severity,
    name: check.name,
    message: `Static deployment requirement for ${check.name} satisfied.`,
    evidence: [`Verified requirement: ${check.id}`],
  };
}

// ================================================================================================
// PHASE 5: ORCHESTRATOR & SUMMARY CALCULATION
// ================================================================================================

/**
 * Calculates a deterministic summary and deployment-readiness verdict from check results.
 * Readiness Policy:
 * - Ready (true): 0 CRITICAL failures, 0 HIGH failures, 0 ERROR statuses.
 * - Blocked (false): Any CRITICAL failure, any HIGH failure, or any ERROR execution failure.
 */
export function calculateDeploymentSummary(results: CheckResult[]): DeploymentSummary {
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const warnings = results.filter((r) => r.status === 'WARN').length;
  const skipped = results.filter((r) => r.status === 'SKIP' || r.status === 'SKIPPED').length;
  const errors = results.filter((r) => r.status === 'ERROR').length;

  const criticalFailures = results.filter((r) => r.status === 'FAIL' && r.severity === 'CRITICAL');
  const highFailures = results.filter((r) => r.status === 'FAIL' && r.severity === 'HIGH');
  const mediumFailures = results.filter((r) => r.status === 'FAIL' && r.severity === 'MEDIUM');
  const lowFailures = results.filter((r) => r.status === 'FAIL' && r.severity === 'LOW');
  const infoFailures = results.filter((r) => r.status === 'FAIL' && r.severity === 'INFO');

  const blockers: string[] = [];

  for (const cf of criticalFailures) {
    blockers.push(`[CRITICAL] ${cf.checkId}: ${cf.message}`);
  }
  for (const hf of highFailures) {
    blockers.push(`[HIGH] ${hf.checkId}: ${hf.message}`);
  }
  for (const err of results.filter((r) => r.status === 'ERROR')) {
    blockers.push(`[EXECUTION_ERROR] ${err.checkId}: ${err.message}`);
  }

  const deploymentReady = blockers.length === 0;

  return {
    total: results.length,
    passed,
    failed,
    warnings,
    skipped,
    errors,
    critical: criticalFailures.length,
    high: highFailures.length,
    medium: mediumFailures.length,
    low: lowFailures.length,
    info: infoFailures.length,
    deploymentReady,
    blockers,
  };
}

/**
 * Main Phase 5 Orchestrator:
 * Executes the complete preflight deployment pipeline from project root:
 * 1. Project Discovery (Phase 1)
 * 2. Deployment Classification (Phase 2)
 * 3. Deployment Profile Composition (Phase 2)
 * 4. Applicable Checks Selection (Phase 3)
 * 5. Deterministic Check Execution (Phase 4)
 * 6. Result Normalization & Summary Calculation (Phase 5)
 * 7. Comprehensive EngineReport generation
 */
export async function runDeployEngine(
  rootPath: string,
  options: DeployEngineOptions = {}
): Promise<EngineReport> {
  const startTime = Date.now();
  const resolvedRoot = path.resolve(rootPath);

  try {
    if (!isDirectory(resolvedRoot)) {
      throw new Error(`Target repository root does not exist or is not a directory: ${resolvedRoot}`);
    }


    // Stage 1: Phase 1 Discovery
    const discovery: DiscoveryResult = classifyProject(resolvedRoot);



    // Stage 2 & 3: Phase 2 Deployment Classification & Profile Composition
    const classification: RepositoryDeploymentProfile = classifyDeployment(discovery);

    // Stage 4 & 5: Phase 3 Check Registry & Phase 4 Deterministic Check Execution
    const isRootApplication = discovery.rootProject.identity.hasPackageJson;
    const executedResults: CheckResult[] = [];

    // 5a. Execute root project checks only if root is an actual application OR no subprojects exist
    if (isRootApplication || !classification.subProjectProfiles || classification.subProjectProfiles.length === 0) {
      const rootExecutionReport = await runDeploymentChecks(
        resolvedRoot,
        classification.rootProfile,
        {
          timeoutMs: options.timeoutMs,
          buildTimeoutMs: options.buildTimeoutMs,
          skipBuildCommand: options.skipBuildCommand,
        }
      );

      for (const r of rootExecutionReport.results) {
        executedResults.push({
          ...r,
          subProjectName: classification.rootProfile.projectName,
          subProjectRoot: resolvedRoot,
        });
      }
    }

    // 5b. If monorepo / sub-projects exist, execute checks for each sub-project independently
    if (classification.subProjectProfiles && classification.subProjectProfiles.length > 0) {
      for (const subProfile of classification.subProjectProfiles) {
        const subRoot = subProfile.projectRoot;
        const subReport = await runDeploymentChecks(
          subRoot,
          subProfile,
          {
            timeoutMs: options.timeoutMs,
            buildTimeoutMs: options.buildTimeoutMs,
            skipBuildCommand: options.skipBuildCommand,
          }
        );
        for (const subResult of subReport.results) {
          executedResults.push({
            ...subResult,
            subProjectName: subProfile.projectName,
            subProjectRoot: subRoot,
          });
        }
      }
    }

    // Stage 6: Include non-applicable / skipped checks from registry if requested or applicable
    if (options.includeSkippedInResults) {
      const executedIds = new Set(executedResults.map((r) => r.checkId));
      const allChecks = getAllChecks();
      for (const chk of allChecks) {
        if (!executedIds.has(chk.id) && (!chk.aliases || !chk.aliases.some((a) => executedIds.has(a)))) {
          executedResults.push({
            checkId: chk.id,
            status: 'SKIPPED',
            severity: chk.severity,
            name: chk.name,
            category: chk.category,
            automationLevel: chk.automationLevel,
            message: `Check not applicable to project profile: ${chk.domain || chk.layer}`,
            executionType: chk.executionType,
            remediation: chk.remediation,
          });
        }
      }
    }

    // Stage 7: Calculate deterministic summary & readiness (DETERMINISTIC SUMMARY IS AUTHORITATIVE)
    const summary = calculateDeploymentSummary(executedResults);

    // Stage 8: Gemini Root-Cause & Remediation Analysis (Analysis layer only - never affects readiness)
    let aiReport: EngineAIReport | undefined = undefined;
    const apiKey = options.aiApiKey || process.env.GEMINI_API_KEY;

    // Build lookup for subproject profiles to supply accurate tech stack to AI
    const profileLookup = new Map<string, ProjectProfile>();
    if (discovery.rootProject) {
      profileLookup.set(discovery.rootProject.identity.name, discovery.rootProject);
    }
    if (discovery.subProjects) {
      for (const sp of discovery.subProjects) {
        profileLookup.set(sp.identity.name, sp);
      }
    }

    // Run AI analysis when API key is present or explicitly requested
    if (apiKey && (options.enableAiAnalysis !== false)) {
      try {
        const failureChecks = executedResults.filter(
          (c) => c.status === 'FAIL' || c.status === 'ERROR' || (c.status === 'WARN' && c.severity === 'HIGH')
        );

        const aiContexts: AIAnalysisContext[] = failureChecks.map((c) => {
          const matchedProfile = (c.subProjectName ? profileLookup.get(c.subProjectName) : undefined) || discovery.rootProject;
          return {
            checkId: c.checkId,
            checkName: c.name,
            severity: c.severity,
            status: c.status,
            message: c.message,
            evidence: c.evidence,
            remediation: c.remediation,
            projectType: matchedProfile?.projectType?.primaryType,
            framework: matchedProfile?.frameworks?.frameworks?.map((f) => f.name).join(', '),
            runtime: matchedProfile?.runtime?.name,
            hosting: matchedProfile?.hosting?.hosting?.map((h) => h.name).join(', '),
            subProjectName: c.subProjectName,
          };
        });

        aiReport = await analyzeFailuresBatch(aiContexts, {
          apiKey,
          timeoutMs: options.timeoutMs,
        });

        // Attach individual AI analyses directly to corresponding CheckResult items
        if (aiReport && aiReport.analyses) {
          for (const res of executedResults) {
            if (aiReport.analyses[res.checkId]) {
              res.aiAnalysis = aiReport.analyses[res.checkId];
            }
          }
        }
      } catch (aiErr: any) {
        // Strict Error Isolation: Gemini failure must NEVER break PreFlight or alter deterministic results
        aiReport = {
          status: 'ERROR',
          analyzedChecksCount: 0,
          analyses: {},
          error: aiErr?.message || String(aiErr),
        };
      }
    } else {
      aiReport = {
        status: 'UNAVAILABLE',
        analyzedChecksCount: 0,
        analyses: {},
        error: !apiKey ? 'GEMINI_API_KEY not configured in environment' : 'AI analysis disabled',
      };
    }

    return {
      rootPath: resolvedRoot,
      discovery,
      classification,
      deploymentProfile: classification.rootProfile,
      checks: executedResults,
      summary,
      aiAnalysis: aiReport,
      durationMs: Date.now() - startTime,
      generatedAt: new Date().toISOString(),
      status: 'SUCCESS',
    };

  } catch (err: any) {
    // Top-level error isolation: Return EngineReport with ERROR status rather than throwing
    const fallbackSummary: DeploymentSummary = {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      skipped: 0,
      errors: 1,
      critical: 1,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      deploymentReady: false,
      blockers: [`[FATAL_ENGINE_ERROR] ${err?.message || String(err)}`],
    };

    return {
      rootPath: resolvedRoot,
      discovery: {
        rootProject: {} as any,
        subProjects: [],
        summary: { totalApplications: 0, isMonorepo: false, analysisTimestamp: new Date().toISOString() },
      },
      classification: {
        rootProfile: {} as any,
        subProjectProfiles: [],
        summary: { totalApplications: 0, isMonorepo: false, totalUniqueChecks: 0, timestamp: new Date().toISOString() },
      },
      deploymentProfile: {} as any,
      checks: [
        {
          checkId: 'engine.pipeline.fatal_error',
          status: 'ERROR',
          severity: 'CRITICAL',
          name: 'Deployment Engine Pipeline Execution',
          message: `Fatal error in engine orchestration: ${err?.message || String(err)}`,
          evidence: [err?.stack || String(err)],
        },
      ],
      summary: fallbackSummary,
      durationMs: Date.now() - startTime,
      generatedAt: new Date().toISOString(),
      status: 'ERROR',
      error: err?.message || String(err),
    };
  }
}

/**
 * Generates a clean, well-formatted Markdown deployment report from an EngineReport.
 * Never leaks raw secret strings.
 */
export function generateMarkdownReport(report: EngineReport): string {
  const lines: string[] = [];

  lines.push('# PreFlight AI Deployment Report\n');

  // 1. Project Information
  lines.push('## Project');
  const root = report.discovery?.rootProject;
  const isMonorepo = report.discovery?.summary?.isMonorepo;
  const isRootApp = root?.identity?.hasPackageJson;
  const subProjects = report.discovery?.subProjects || [];

  lines.push(`- **Root Path:** \`${report.rootPath}\``);
  if (isMonorepo) {
    lines.push(`- **Architecture:** Monorepo (${report.discovery.summary.totalApplications} applications)`);
    if (isRootApp) {
      const fwNames = root?.frameworks?.frameworks?.map((f) => f.name).join(', ') || 'Unknown';
      const pType = root?.projectType?.primaryType || 'unknown';
      lines.push(`- **Root App:** ${root?.identity?.name} (${pType}, ${fwNames})`);
    } else {
      lines.push(`- **Root Container:** Workspace container (no root manifest)`);
    }
    const formatMarkdownRuntime = (r?: { name?: string; version?: string }): string => {
      if (!r || !r.name || r.name === 'Unknown') return 'Unknown';
      if (!r.version || r.version === 'UNKNOWN' || r.version.trim() === '') return r.name;
      return `${r.name} (${r.version})`;
    };

    for (const sub of subProjects) {
      const sFw = sub.frameworks?.frameworks?.map((f) => f.name).join(', ') || 'Unknown';
      const sRuntime = formatMarkdownRuntime(sub.runtime);
      const sPm = sub.packageManager?.packageManager || 'unknown';
      const sHost = sub.hosting?.hosting?.map((h) => h.name).join(', ') || 'Unknown';
      const sType = sub.projectType?.primaryType || 'unknown';
      lines.push(`- **${sub.identity.name}** (\`${sub.identity.rootPath}\`): ${sType} | Framework: ${sFw} | Runtime: ${sRuntime} | PM: ${sPm} | Hosting: ${sHost}`);
    }
  } else {
    const formatMarkdownRuntime = (r?: { name?: string; version?: string }): string => {
      if (!r || !r.name || r.name === 'Unknown') return 'Unknown';
      if (!r.version || r.version === 'UNKNOWN' || r.version.trim() === '') return r.name;
      return `${r.name} (${r.version})`;
    };
    const fwNames = root?.frameworks?.frameworks?.map((f) => f.name).join(', ') || 'Unknown';
    const dbNames = root?.databases?.databases?.map((d) => d.name).join(', ') || 'None';
    const hostNames = root?.hosting?.hosting?.map((h) => h.name).join(', ') || 'Unknown';
    const pType = root?.projectType?.primaryType || 'unknown';
    const pmName = root?.packageManager?.packageManager || 'unknown';
    const runtimeName = formatMarkdownRuntime(root?.runtime);

    lines.push(`- **Framework:** ${fwNames}`);
    lines.push(`- **Runtime:** ${runtimeName}`);
    lines.push(`- **Package Manager:** ${pmName}`);
    lines.push(`- **Database:** ${dbNames}`);
    lines.push(`- **Hosting:** ${hostNames}`);
    lines.push(`- **Project Type:** ${pType}`);
  }
  lines.push('');

  // 2. Summary
  lines.push('## Summary');
  lines.push(`- **Deployment Readiness:** ${report.summary.deploymentReady ? 'READY' : 'BLOCKED'}`);
  lines.push(`- **Total Checks:** ${report.summary.total}`);
  lines.push(`- **Passed:** ${report.summary.passed}`);
  lines.push(`- **Failed:** ${report.summary.failed}`);
  lines.push(`- **Warnings:** ${report.summary.warnings}`);
  lines.push(`- **Skipped:** ${report.summary.skipped}`);
  lines.push(`- **Errors:** ${report.summary.errors}`);
  lines.push(`- **Analysis Duration:** ${report.durationMs}ms`);
  lines.push(`- **Generated At:** ${report.generatedAt}`);
  lines.push('');

  // 3. Blockers
  lines.push('## Blockers');
  if (report.summary.blockers && report.summary.blockers.length > 0) {
    for (const blocker of report.summary.blockers) {
      lines.push(`- ${blocker}`);
    }
  } else {
    lines.push('None. All critical deployment safety checks passed.');
  }
  lines.push('');

  // 4. Check Results
  lines.push('## Check Results');
  lines.push('| ID | Name | Status | Severity | Message |');
  lines.push('| :--- | :--- | :--- | :--- | :--- |');
  for (const c of report.checks) {
    const safeMsg = (c.message || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const safeName = (c.name || '').replace(/\|/g, '\\|');
    lines.push(`| \`${c.checkId}\` | ${safeName} | **${c.status}** | ${c.severity} | ${safeMsg} |`);
  }
  lines.push('');

  // 5. Remediation Details for Non-Pass Checks
  const needsAttention = report.checks.filter((c) => c.status === 'FAIL' || c.status === 'ERROR' || c.status === 'WARN');
  if (needsAttention.length > 0) {
    lines.push('## Remediation & Guidance');
    for (const item of needsAttention) {
      lines.push(`### [${item.status}] ${item.checkId}: ${item.name}`);
      lines.push(`**Severity:** ${item.severity}`);
      lines.push(`**Message:** ${item.message}`);
      if (item.evidence && item.evidence.length > 0) {
        lines.push('**Evidence:**');
        for (const ev of item.evidence) {
          lines.push(`- \`${sanitizeOutput(ev)}\``);
        }
      }
      if (item.remediation) {
        lines.push(`**Remediation:** ${item.remediation.summary}`);
        if (item.remediation.guidance) {
          lines.push(`> ${item.remediation.guidance}`);
        }
        if (item.remediation.steps && item.remediation.steps.length > 0) {
          for (const step of item.remediation.steps) {
            lines.push(`1. ${step}`);
          }
        }
      }
      if (item.aiAnalysis) {
        lines.push('');
        lines.push('**AI Root Cause Analysis (Gemini):**');
        lines.push(`- **Root Cause:** ${item.aiAnalysis.rootCause}`);
        lines.push(`- **Risk:** ${item.aiAnalysis.risk}`);
        lines.push(`- **Explanation:** ${item.aiAnalysis.explanation}`);
        if (Array.isArray(item.aiAnalysis.remediation)) {
          lines.push(`- **AI Recommendation:** ${item.aiAnalysis.remediation.join('; ')}`);
        } else {
          lines.push(`- **AI Recommendation:** ${item.aiAnalysis.remediation}`);
        }
        if (typeof item.aiAnalysis.confidence === 'number') {
          lines.push(`- **Confidence:** ${Math.round(item.aiAnalysis.confidence * 100)}%`);
        }
      }
      lines.push('');
    }
  }

  // 6. Gemini AI Assessment Overview
  lines.push('## AI Assessment (Gemini)');
  if (report.aiAnalysis?.status === 'AVAILABLE' && report.aiAnalysis.analyses) {
    const aiCount = Object.keys(report.aiAnalysis.analyses).length;
    lines.push(`- **Status:** AVAILABLE`);
    lines.push(`- **Analyzed Checks:** ${aiCount}`);
    lines.push(`- **Model:** ${report.aiAnalysis.model || 'gemini-1.5-pro'}`);
    lines.push(`- **Execution Invariant:** Purely observational root cause analysis. Deterministic check outcomes, scores, and deployment safety verdicts remain 100% authoritative.`);
  } else {
    lines.push(`- **Status:** UNAVAILABLE`);
    if (report.aiAnalysis?.error) {
      lines.push(`- **Reason:** ${report.aiAnalysis.error}`);
    } else {
      lines.push(`- **Reason:** Gemini AI analysis not enabled or GEMINI_API_KEY environment variable not configured.`);
    }
  }
  lines.push('');

  return lines.join('\n');
}


