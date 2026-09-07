import * as path from 'path';
import { isDirectory, isFile, listImmediateEntries, readTextFile } from '../utils/filesystem';
import { readPackageJson, PackageMetadata, extractWorkspacePatterns, matchesWorkspacePattern } from '../utils/package';
import { ProjectIdentity, RepositoryFacts } from '../types';

/**
 * Common candidate directory roots when no explicit workspaces configuration exists.
 */
const HEURISTIC_SUBDIR_CANDIDATES = [
  'apps',
  'packages',
  'frontend',
  'backend',
  'client',
  'server',
  'web',
  'api',
  'services',
  'modules',
  'platform',
  'products',
  'components',
  'tools',
  'ui',
];

/**
 * Directories never treated as child project roots.
 */
const IGNORED_CHILD_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  'out',
  '.cache',
  'public',
  'static',
]);

/**
 * Discover identity of a project directory.
 * If repositoryFacts is supplied, performs O(1) indexed lookups and dynamic workspace glob matching
 * across any arbitrary depth without rigid depth limitations.
 */
export function discoverProjectIdentity(
  projectRoot: string,
  repositoryFacts?: RepositoryFacts
): {
  identity: ProjectIdentity;
  packageMetadata: PackageMetadata;
} {
  const resolvedRoot = path.resolve(projectRoot);
  const existsDir = isDirectory(resolvedRoot);
  const packageMetadata = readPackageJson(resolvedRoot);

  const dirName = path.basename(resolvedRoot) || 'unnamed-project';
  const name = packageMetadata.raw?.name || dirName;

  // Search for child projects
  const childRootsSet = new Set<string>();

  // Check pnpm-workspace.yaml if present
  let pnpmYamlContent: string | null = null;
  const pnpmYamlPath = path.join(resolvedRoot, 'pnpm-workspace.yaml');
  if (isFile(pnpmYamlPath)) {
    pnpmYamlContent = readTextFile(pnpmYamlPath);
  }

  const workspacePatterns = extractWorkspacePatterns(packageMetadata.raw, pnpmYamlContent);

  if (repositoryFacts && repositoryFacts.rootPath === resolvedRoot) {
    // -------------------------------------------------------------
    // DYNAMIC FACT-BASED WORKSPACE & PACKAGE RESOLUTION
    // -------------------------------------------------------------
    for (const pkgRelPath of repositoryFacts.packageJsonPaths) {
      if (pkgRelPath === 'package.json') continue; // Skip root package.json

      const childDirRel = path.dirname(pkgRelPath).replace(/\\/g, '/');

      // Check if child matches explicit workspace pattern
      if (workspacePatterns.length > 0) {
        for (const pattern of workspacePatterns) {
          if (matchesWorkspacePattern(childDirRel, pattern)) {
            childRootsSet.add(childDirRel);
            break;
          }
        }
      } else {
        // If no explicit workspace patterns defined in root, treat any package.json under non-ignored directories as a child project.
        const segments = childDirRel.split('/');
        const hasIgnored = segments.some(seg => IGNORED_CHILD_DIRS.has(seg));
        if (!hasIgnored) {
          childRootsSet.add(childDirRel);
        }
      }
    }
  } else if (existsDir) {
    // -------------------------------------------------------------
    // FILESYSTEM FALLBACK (when repository facts not pre-indexed)
    // -------------------------------------------------------------
    // Recursive search for any directory containing package.json
    const searchDir = (dir: string, relPrefix: string, depth: number) => {
      if (depth > 10) return;
      const entries = listImmediateEntries(dir);
      for (const entry of entries) {
        if (!entry.isDirectory || IGNORED_CHILD_DIRS.has(entry.name)) continue;
        const subDir = path.join(dir, entry.name);
        const childRel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
        const pkgFile = path.join(subDir, 'package.json');
        if (isFile(pkgFile)) {
          childRootsSet.add(childRel);
        } else {
          searchDir(subDir, childRel, depth + 1);
        }
      }
    };
    searchDir(resolvedRoot, '', 1);
  }

  // Deduplicate and filter out nested children inside an already discovered child
  // E.g. if packages/app is discovered, do not treat packages/app/node_modules/foo as child
  const sortedChildRoots = Array.from(childRootsSet).sort((a, b) => a.localeCompare(b));
  const deduplicatedRoots: string[] = [];
  for (const root of sortedChildRoots) {
    // Ensure not inside ignored dir and not already covered by higher parent
    const isInsideIgnored = root.split('/').some((seg) => IGNORED_CHILD_DIRS.has(seg));
    if (!isInsideIgnored) {
      deduplicatedRoots.push(root);
    }
  }

// Build identity object
  const isMonorepoRoot = workspacePatterns.length > 0 || deduplicatedRoots.length > 0;

  const isValidProject =
    packageMetadata.isValid ||
    packageMetadata.isMalformed ||
    deduplicatedRoots.length > 0 ||
    isFile(path.join(resolvedRoot, 'tsconfig.json')) ||
    isFile(path.join(resolvedRoot, 'jsconfig.json'));

  const identity: ProjectIdentity = {
    name,
    rootPath: resolvedRoot,
    hasPackageJson: isFile(packageMetadata.filePath),
    isValidProject,
    isMonorepoRoot,
    childProjectRoots: deduplicatedRoots,
  };

  return {
    identity,
    packageMetadata,
  };
}

