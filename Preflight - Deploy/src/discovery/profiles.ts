import * as path from 'path';
import { isFile, countExtensions, findFiles, factHasFile, factCountExtensions } from '../utils/filesystem';
import { PackageMetadata, hasDependency } from '../utils/package';
import {
  PackageManagerDetection,
  PackageManagerName,
  LanguageDetection,
  ProjectProfile,
  ProjectIdentity,
  FrameworkDetection,
  DatabaseDetection,
  RuntimeDetection,
  HostingDetection,
  ProjectTypeDetection,
  ProjectFacts,
} from '../types';

/**
 * Detect package manager using lockfiles and project metadata.
 * Detects conflicts if multiple lockfiles are present.
 */
export function detectPackageManager(
  projectRoot: string,
  packageMetadata: PackageMetadata,
  projectFacts?: ProjectFacts
): PackageManagerDetection {
  const lockfileMap: Record<string, PackageManagerName> = {
    'pnpm-lock.yaml': 'pnpm',
    'yarn.lock': 'yarn',
    'bun.lock': 'bun',
    'bun.lockb': 'bun',
    'package-lock.json': 'npm',
  };

  const checkFile = (relativeFilePath: string): boolean => {
    if (projectFacts) {
      return factHasFile(projectFacts, relativeFilePath);
    }
    return isFile(path.join(projectRoot, relativeFilePath));
  };

  const foundLockfiles: { file: string; pm: PackageManagerName }[] = [];
  for (const [file, pm] of Object.entries(lockfileMap)) {
    if (checkFile(file)) {
      if (!foundLockfiles.some((f) => f.file === file)) {
        foundLockfiles.push({ file, pm });
      }
    }
  }

  const evidence: string[] = [];

  // If package.json has a "packageManager" field:
  const pmField = packageMetadata.raw?.packageManager;
  if (pmField) {
    evidence.push(`packageManager field in package.json specifies "${pmField}"`);
  }

  if (foundLockfiles.length === 1) {
    const single = foundLockfiles[0];
    evidence.push(`Lockfile "${single.file}" found`);
    return {
      packageManager: single.pm,
      confidence: 'DETECTED',
      lockfile: single.file,
      evidence,
    };
  }

  if (foundLockfiles.length > 1) {
    // Conflict detected!
    const conflictFiles = foundLockfiles.map((f) => f.file);
    const conflicts = conflictFiles;
    evidence.push(`Multiple lockfiles detected (${conflictFiles.join(', ')}). Conflict recorded.`);

    // If packageManager field matches one, honor it
    if (pmField) {
      for (const item of foundLockfiles) {
        if (pmField.toLowerCase().startsWith(item.pm)) {
          evidence.push(`Resolved conflict in favor of "${item.pm}" based on package.json packageManager specification`);
          return {
            packageManager: item.pm,
            confidence: 'DETECTED',
            lockfile: item.file,
            evidence,
            conflicts,
          };
        }
      }
    }

    // Deterministic priority fallback: pnpm > yarn > bun > npm
    const priority: PackageManagerName[] = ['pnpm', 'yarn', 'bun', 'npm'];
    for (const p of priority) {
      const match = foundLockfiles.find((f) => f.pm === p);
      if (match) {
        evidence.push(`Conflict resolved to "${match.pm}" via deterministic priority rule`);
        return {
          packageManager: match.pm,
          confidence: 'LIKELY',
          lockfile: match.file,
          evidence,
          conflicts,
        };
      }
    }
  }

  // No lockfile found
  if (pmField) {
    const lower = pmField.toLowerCase();
    if (lower.startsWith('pnpm')) return { packageManager: 'pnpm', confidence: 'LIKELY', evidence };
    if (lower.startsWith('yarn')) return { packageManager: 'yarn', confidence: 'LIKELY', evidence };
    if (lower.startsWith('bun')) return { packageManager: 'bun', confidence: 'LIKELY', evidence };
    if (lower.startsWith('npm')) return { packageManager: 'npm', confidence: 'LIKELY', evidence };
  }

  if (packageMetadata.isMalformed) {
    evidence.push('package.json is malformed; package manager cannot be verified');
    return {
      packageManager: 'unknown',
      confidence: 'UNKNOWN',
      evidence,
    };
  }

  if (packageMetadata.isValid) {
    evidence.push('No lockfile found; default Node.js package manager is npm');
    return {
      packageManager: 'npm',
      confidence: 'LIKELY',
      evidence,
    };
  }

  return {
    packageManager: 'unknown',
    confidence: 'UNKNOWN',
    evidence: ['No lockfile or package.json found'],
  };
}

/**
 * Detect programming languages (TypeScript, JavaScript).
 * Inspects tsconfig.json, dependencies, and actual source file extensions (.ts, .tsx, .js, .jsx).
 */
export function detectLanguages(
  projectRoot: string,
  packageMetadata: PackageMetadata,
  projectFacts?: ProjectFacts
): LanguageDetection {
  const pkg = packageMetadata.raw;
  const languages: LanguageDetection['languages'] = [];

  const checkFile = (relativeFilePath: string): boolean => {
    if (projectFacts) {
      return factHasFile(projectFacts, relativeFilePath);
    }
    return isFile(path.join(projectRoot, relativeFilePath));
  };

  // Check tsconfig.json
  const hasTsConfig = checkFile('tsconfig.json');
  const tsDep = hasDependency(pkg, 'typescript');

  // Count source files
  const counts = projectFacts
    ? factCountExtensions(projectFacts, ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
    : countExtensions(projectRoot, ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'], 4);

  const tsCount = counts['.ts'] + counts['.tsx'];
  const jsCount = counts['.js'] + counts['.jsx'] + counts['.mjs'] + counts['.cjs'];

  // TypeScript evaluation
  const tsEvidence: string[] = [];
  if (hasTsConfig) tsEvidence.push('tsconfig.json exists at project root');
  if (tsDep.found) tsEvidence.push(`"typescript" dependency (${tsDep.version}) found in ${tsDep.section}`);
  if (tsCount > 0) tsEvidence.push(`${tsCount} TypeScript source file(s) (.ts/.tsx) found`);

  if (tsEvidence.length > 0) {
    const isDetected = hasTsConfig || (tsDep.found && tsCount > 0) || tsCount > 2;
    languages.push({
      language: 'TypeScript',
      confidence: isDetected ? 'DETECTED' : 'LIKELY',
      evidence: tsEvidence,
    });
  }

  // JavaScript evaluation
  const jsEvidence: string[] = [];
  if (jsCount > 0) jsEvidence.push(`${jsCount} JavaScript source file(s) (.js/.jsx/.mjs/.cjs) found`);
  if (packageMetadata.hasPackageJson && tsEvidence.length === 0) {
    jsEvidence.push('package.json present with standard JavaScript runtime environment');
  }

  if (jsEvidence.length > 0) {
    languages.push({
      language: 'JavaScript',
      confidence: 'DETECTED',
      evidence: jsEvidence,
    });
  }

  // Determine primary language
  let primary: LanguageDetection['primary'] = 'unknown';
  if (tsCount > 0 || hasTsConfig) {
    primary = 'TypeScript';
  } else if (jsCount > 0 || packageMetadata.hasPackageJson) {
    primary = 'JavaScript';
  }

  return {
    primary,
    languages,
  };
}

/**
 * Builds a structured ProjectProfile from individual detector facts.
 */
export function createProjectProfile(params: {
  identity: ProjectIdentity;
  packageManager: PackageManagerDetection;
  languages: LanguageDetection;
  frameworks: FrameworkDetection;
  databases: DatabaseDetection;
  runtime: RuntimeDetection;
  hosting: HostingDetection;
  projectType: ProjectTypeDetection;
}): ProjectProfile {
  const rawEvidence: string[] = [
    ...params.packageManager.evidence.map((e) => `[package-manager] ${e}`),
    ...params.languages.languages.flatMap((l) => l.evidence.map((e) => `[language:${l.language}] ${e}`)),
    ...params.frameworks.frameworks.flatMap((f) => f.evidence.map((e) => `[framework:${f.name}] ${e}`)),
    ...params.databases.databases.flatMap((d) => d.evidence.map((e) => `[database:${d.name}] ${e}`)),
    ...params.runtime.evidence.map((e) => `[runtime] ${e}`),
    ...params.hosting.hosting.flatMap((h) => h.evidence.map((e) => `[hosting:${h.name}] ${e}`)),
    ...params.projectType.evidence.map((e) => `[project-type] ${e}`),
  ];

  return {
    ...params,
    rawEvidence,
  };
}
