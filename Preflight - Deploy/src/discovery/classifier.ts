import * as path from 'path';
import { buildRepositoryFacts, createProjectFacts } from '../utils/filesystem';
import { discoverProjectIdentity } from './project';
import { detectFrameworks } from './detectors/framework';
import { detectDatabases } from './detectors/database';
import { detectRuntime } from './detectors/runtime';
import { detectHosting } from './detectors/hosting';
import { detectProjectType } from './detectors/project-type';
import { detectPackageManager, detectLanguages, createProjectProfile } from './profiles';
import { ProjectProfile, DiscoveryResult, RepositoryFacts, ProjectFacts } from '../types';

/**
 * Analyzes a single project directory (root or subproject) deterministically.
 * Uses pre-built repository facts when available for O(1) indexed lookups.
 */
export function analyzeProjectDirectory(
  projectRoot: string,
  repositoryFacts?: RepositoryFacts
): ProjectProfile {
  const { identity, packageMetadata } = discoverProjectIdentity(projectRoot, repositoryFacts);

  const projectFacts: ProjectFacts | undefined = repositoryFacts
    ? createProjectFacts(projectRoot, repositoryFacts)
    : undefined;

  const packageManager = detectPackageManager(projectRoot, packageMetadata, projectFacts);
  const languages = detectLanguages(projectRoot, packageMetadata, projectFacts);
  const frameworks = detectFrameworks(projectRoot, packageMetadata, projectFacts);
  const databases = detectDatabases(projectRoot, packageMetadata, projectFacts);
  const runtime = detectRuntime(projectRoot, packageMetadata, projectFacts);
  const hosting = detectHosting(projectRoot, packageMetadata, projectFacts);
  const projectType = detectProjectType(projectRoot, packageMetadata, frameworks.frameworks, projectFacts);

  return createProjectProfile({
    identity,
    packageManager,
    languages,
    frameworks,
    databases,
    runtime,
    hosting,
    projectType,
  });
}

/**
 * Discovers project profile for the given root and recursively analyzes any detected sub-applications.
 * Performs a SINGLE indexed discovery pass across the repository to gather RepositoryFacts.
 */
export function classifyProject(projectRoot: string): DiscoveryResult {
  const resolvedRoot = path.resolve(projectRoot);

  // 1. Single unified filesystem indexing pass
  const repositoryFacts = buildRepositoryFacts(resolvedRoot);

  // 2. Discover root project profile using indexed facts
  const rootProfile = analyzeProjectDirectory(resolvedRoot, repositoryFacts);

  // 3. Discover each sub-project profile using the same cached repository facts
  const subProfiles: ProjectProfile[] = [];
  if (rootProfile.identity.childProjectRoots.length > 0) {
    for (const childRelPath of rootProfile.identity.childProjectRoots) {
      const childFullPath = path.join(resolvedRoot, childRelPath);
      const childProfile = analyzeProjectDirectory(childFullPath, repositoryFacts);
      subProfiles.push(childProfile);
    }
  }

  const isMonorepo = rootProfile.identity.isMonorepoRoot;
  const isRootApplication = rootProfile.identity.hasPackageJson;
  const totalApplications = isMonorepo
    ? (isRootApplication ? 1 + subProfiles.length : subProfiles.length)
    : 1;

  return {
    rootProject: rootProfile,
    subProjects: subProfiles,
    summary: {
      totalApplications,
      isMonorepo,
      analysisTimestamp: new Date().toISOString(),
      traversalStats: repositoryFacts.stats,
    },
  };
}

/**
 * Formats discovery result into human-readable report string.
 */
export function formatDiscoveryReport(result: DiscoveryResult): string {
  const lines: string[] = [];

  const formatProfile = (profile: ProjectProfile, isSub = false) => {
    const indent = isSub ? '  ' : '';
    lines.push(`${indent}Project:`);
    lines.push(`${indent}  Name: ${profile.identity.name}`);
    lines.push(`${indent}  Root: ${profile.identity.rootPath}`);
    if (profile.identity.isMonorepoRoot && !isSub) {
      lines.push(`${indent}  Structure: Monorepo / Multi-project container`);
      lines.push(`${indent}  Sub-projects: ${profile.identity.childProjectRoots.join(', ') || 'none'}`);
    }

    lines.push(`${indent}Package Manager:`);
    lines.push(`${indent}  ${profile.packageManager.packageManager} [${profile.packageManager.confidence}]`);
    if (profile.packageManager.conflicts && profile.packageManager.conflicts.length > 0) {
      lines.push(`${indent}  Warning: Lockfile conflict (${profile.packageManager.conflicts.join(', ')})`);
    }

    lines.push(`${indent}Languages:`);
    for (const lang of profile.languages.languages) {
      lines.push(`${indent}  ${lang.language} — ${lang.confidence}`);
    }

    lines.push(`${indent}Frameworks:`);
    for (const fw of profile.frameworks.frameworks) {
      lines.push(`${indent}  ${fw.name} — ${fw.confidence}${fw.version ? ` (${fw.version})` : ''}`);
    }

    lines.push(`${indent}Database:`);
    for (const db of profile.databases.databases) {
      lines.push(`${indent}  ${db.name} — ${db.confidence}`);
    }

    lines.push(`${indent}Runtime:`);
    lines.push(`${indent}  ${profile.runtime.name}`);
    lines.push(`${indent}  Version: ${profile.runtime.version}`);

    lines.push(`${indent}Hosting:`);
    for (const h of profile.hosting.hosting) {
      lines.push(`${indent}  ${h.name} — ${h.confidence}`);
    }

    lines.push(`${indent}Project Type:`);
    lines.push(`${indent}  Primary: ${profile.projectType.primaryType} [${profile.projectType.confidence}]`);
    if (profile.projectType.secondaryTypes.length > 0) {
      lines.push(`${indent}  Secondary: ${profile.projectType.secondaryTypes.join(', ')}`);
    }

    lines.push(`${indent}Evidence:`);
    for (const ev of profile.rawEvidence.slice(0, 10)) {
      lines.push(`${indent}  • ${ev}`);
    }
    if (profile.rawEvidence.length > 10) {
      lines.push(`${indent}  • ... and ${profile.rawEvidence.length - 10} more evidence signals`);
    }
  };

  lines.push('PreFlight Project Discovery');
  lines.push('────────────────────────────');
  formatProfile(result.rootProject);

  if (result.subProjects.length > 0) {
    lines.push('');
    lines.push('Discovered Sub-Applications:');
    lines.push('────────────────────────────');
    for (const sub of result.subProjects) {
      formatProfile(sub, true);
      lines.push('');
    }
  }

  return lines.join('\n');
}
