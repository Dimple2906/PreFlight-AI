import * as fs from 'fs';
import * as path from 'path';
import { IndexedFile, RepositoryFacts, ProjectFacts } from '../types';

/**
 * Standard directories excluded from deep scanning to avoid performance degradation
 * or misleading build artifacts.
 */
export const DEFAULT_EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  '.turbo',
  '.cache',
  'coverage',
  '.nuxt',
  '.output',
  'vendor',
  '.svn',
  '.hg',
]);

/**
 * Max size for text files to be read into memory during discovery (512 KB).
 * Protects against huge bundle files, logs, or memory exhaustion.
 */
export const MAX_READ_FILE_SIZE_BYTES = 512 * 1024;

/**
 * Safety limits for repository indexing traversal.
 */
export interface TraversalLimits {
  maxDepth?: number;
  maxDirectories?: number;
  maxFiles?: number;
  excludedDirs?: Set<string>;
}

export const DEFAULT_TRAVERSAL_LIMITS: Required<TraversalLimits> = {
  maxDepth: 10,
  maxDirectories: 3000,
  maxFiles: 15000,
  excludedDirs: DEFAULT_EXCLUDED_DIRS,
};

/**
 * Safely checks if a file or directory exists.
 */
export function exists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Safely checks if a path exists and is a regular file.
 */
export function isFile(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Safely checks if a path exists and is a directory.
 */
export function isDirectory(dirPath: string): boolean {
  try {
    const stat = fs.statSync(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Safely read a text file with size limit; returns null if missing, binary, or error.
 */
export function readTextFile(filePath: string, maxSizeBytes = MAX_READ_FILE_SIZE_BYTES): string | null {
  try {
    if (!isFile(filePath)) return null;
    const stat = fs.statSync(filePath);
    if (stat.size > maxSizeBytes) return null; // Reject oversized files
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Lists immediate children (files and directories) within a directory.
 */
export function listImmediateEntries(dirPath: string): { name: string; isDirectory: boolean; isFile: boolean }[] {
  try {
    if (!isDirectory(dirPath)) return [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  } catch {
    return [];
  }
}

/**
 * Builds a unified RepositoryFacts index in ONE SINGLE bounded traversal pass.
 * - Respects depth limits (default: 10)
 * - Respects directory & file count limits
 * - Disallows following external symlink loops
 * - Tracks discovered package.json paths
 * - Caches file map for O(1) existence checks
 */
export function buildRepositoryFacts(
  repositoryRoot: string,
  limits: TraversalLimits = {}
): RepositoryFacts {
  const startTime = Date.now();
  const resolvedRoot = path.resolve(repositoryRoot);

  const maxDepth = limits.maxDepth ?? DEFAULT_TRAVERSAL_LIMITS.maxDepth;
  const maxDirs = limits.maxDirectories ?? DEFAULT_TRAVERSAL_LIMITS.maxDirectories;
  const maxFiles = limits.maxFiles ?? DEFAULT_TRAVERSAL_LIMITS.maxFiles;
  const excludedDirs = limits.excludedDirs ?? DEFAULT_TRAVERSAL_LIMITS.excludedDirs;

  const files: IndexedFile[] = [];
  const directories: string[] = [];
  const packageJsonPaths: string[] = [];
  const fileMap = new Map<string, IndexedFile>();
  const contentCache = new Map<string, string>();

  let directoriesVisited = 0;
  let filesReadCount = 0;

  // Track visited real directory paths to prevent symlink loops
  const visitedRealDirs = new Set<string>();

  function walk(currentDir: string, currentDepth: number) {
    if (currentDepth > maxDepth || directoriesVisited >= maxDirs || files.length >= maxFiles) {
      return;
    }

    try {
      const realPath = fs.realpathSync(currentDir);
      if (visitedRealDirs.has(realPath)) {
        return; // Loop detected
      }
      visitedRealDirs.add(realPath);
    } catch {
      // If realpath fails (e.g. broken symlink), abort traversal of this branch
      return;
    }

    directoriesVisited++;

    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (excludedDirs.has(entry.name)) {
          continue;
        }

        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(resolvedRoot, fullPath).replace(/\\/g, '/');

        // Check if symlink
        if (entry.isSymbolicLink()) {
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              // Only follow symlinks if within repository root and not looping
              const targetReal = fs.realpathSync(fullPath);
              if (targetReal.startsWith(resolvedRoot) && !visitedRealDirs.has(targetReal)) {
                directories.push(relPath);
                walk(fullPath, currentDepth + 1);
              }
            } else if (stat.isFile() && files.length < maxFiles) {
              const ext = path.extname(entry.name).toLowerCase();
              const indexed: IndexedFile = {
                relativePath: relPath,
                fileName: entry.name,
                extension: ext,
                sizeBytes: stat.size,
              };
              files.push(indexed);
              fileMap.set(relPath, indexed);
              if (entry.name === 'package.json') {
                packageJsonPaths.push(relPath);
              }
            }
          } catch {
            // Broken symlink, ignore
          }
          continue;
        }

        if (entry.isFile()) {
          if (files.length >= maxFiles) continue;
          let size = 0;
          try {
            size = fs.statSync(fullPath).size;
          } catch {}

          const ext = path.extname(entry.name).toLowerCase();
          const indexed: IndexedFile = {
            relativePath: relPath,
            fileName: entry.name,
            extension: ext,
            sizeBytes: size,
          };
          files.push(indexed);
          fileMap.set(relPath, indexed);

          if (entry.name === 'package.json') {
            packageJsonPaths.push(relPath);
          }
        } else if (entry.isDirectory()) {
          directories.push(relPath);
          walk(fullPath, currentDepth + 1);
        }
      }
    } catch {
      // Ignore unreadable directories
    }
  }

  if (isDirectory(resolvedRoot)) {
    walk(resolvedRoot, 0);
  }

  const traversalTimeMs = Date.now() - startTime;

  return {
    rootPath: resolvedRoot,
    files,
    directories,
    packageJsonPaths,
    fileMap,
    contentCache,
    stats: {
      totalDirectoriesVisited: directoriesVisited,
      totalFilesIndexed: files.length,
      traversalTimeMs,
      filesReadCount,
    },
  };
}

/**
 * Creates scoped ProjectFacts for a given project directory from the central RepositoryFacts index.
 */
export function createProjectFacts(
  projectRoot: string,
  repositoryFacts: RepositoryFacts
): ProjectFacts {
  const resolvedRoot = path.resolve(projectRoot);
  const relPrefix = path.relative(repositoryFacts.rootPath, resolvedRoot).replace(/\\/g, '/');
  const prefix = relPrefix === '' ? '' : `${relPrefix}/`;

  const localFiles = prefix === ''
    ? repositoryFacts.files
    : repositoryFacts.files.filter((f) => f.relativePath.startsWith(prefix));

  const localDirectories = prefix === ''
    ? repositoryFacts.directories
    : repositoryFacts.directories
        .filter((d) => d.startsWith(prefix))
        .map((d) => d.slice(prefix.length));

  return {
    projectRoot: resolvedRoot,
    relativePrefix: relPrefix,
    repositoryFacts,
    localFiles,
    localDirectories,
  };
}

/**
 * Fast O(1) check if a relative file exists within a project root using the index.
 */
export function factHasFile(projectFacts: ProjectFacts, relativeFilePath: string): boolean {
  const clean = relativeFilePath.replace(/\\/g, '/').replace(/^\//, '');
  const targetRel = projectFacts.relativePrefix === ''
    ? clean
    : `${projectFacts.relativePrefix}/${clean}`;
  return projectFacts.repositoryFacts.fileMap.has(targetRel);
}

/**
 * Fast check if any file exists matching a predicate within the project scope.
 */
export function factFindFiles(
  projectFacts: ProjectFacts,
  predicate: (file: IndexedFile) => boolean
): IndexedFile[] {
  return projectFacts.localFiles.filter(predicate);
}

/**
 * Fast O(1) directory existence check using indexed directories.
 */
export function factHasDirectory(projectFacts: ProjectFacts, relativeDirPath: string): boolean {
  const clean = relativeDirPath.replace(/\\/g, '/').replace(/\/$/, '').replace(/^\//, '');
  const targetRel = projectFacts.relativePrefix === ''
    ? clean
    : `${projectFacts.relativePrefix}/${clean}`;
  return projectFacts.repositoryFacts.directories.includes(targetRel);
}

/**
 * Reads text content with caching attached to the RepositoryFacts.
 */
export function factReadTextFile(projectFacts: ProjectFacts, relativeFilePath: string): string | null {
  const clean = relativeFilePath.replace(/\\/g, '/').replace(/^\//, '');
  const targetRel = projectFacts.relativePrefix === ''
    ? clean
    : `${projectFacts.relativePrefix}/${clean}`;

  if (projectFacts.repositoryFacts.contentCache.has(targetRel)) {
    return projectFacts.repositoryFacts.contentCache.get(targetRel)!;
  }

  const fullPath = path.join(projectFacts.repositoryFacts.rootPath, targetRel);
  const content = readTextFile(fullPath);
  if (content !== null) {
    projectFacts.repositoryFacts.contentCache.set(targetRel, content);
    projectFacts.repositoryFacts.stats.filesReadCount++;
  }
  return content;
}

/**
 * Fast file extension counts using the pre-indexed file entries.
 */
export function factCountExtensions(
  projectFacts: ProjectFacts,
  extensions: string[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  const targetExts = new Set(extensions.map((e) => (e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`)));
  for (const ext of targetExts) {
    counts[ext] = 0;
  }

  for (const f of projectFacts.localFiles) {
    if (targetExts.has(f.extension)) {
      counts[f.extension] = (counts[f.extension] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Legacy recursive file finder for backward compatibility.
 */
export function findFiles(
  dirPath: string,
  predicate: (fileName: string, relativePath: string) => boolean,
  options: {
    maxDepth?: number;
    excludedDirs?: Set<string>;
    currentDepth?: number;
    baseDir?: string;
  } = {}
): string[] {
  const maxDepth = options.maxDepth ?? 5;
  const currentDepth = options.currentDepth ?? 0;
  const excludedDirs = options.excludedDirs ?? DEFAULT_EXCLUDED_DIRS;
  const baseDir = options.baseDir ?? dirPath;

  if (currentDepth > maxDepth) return [];
  if (!isDirectory(dirPath)) return [];

  const results: string[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (excludedDirs.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

      if (entry.isFile()) {
        if (predicate(entry.name, relPath)) {
          results.push(relPath);
        }
      } else if (entry.isDirectory()) {
        const subFiles = findFiles(fullPath, predicate, {
          maxDepth,
          currentDepth: currentDepth + 1,
          excludedDirs,
          baseDir,
        });
        results.push(...subFiles);
      }
    }
  } catch {}

  return results;
}

/**
 * Legacy extension counter for backward compatibility.
 */
export function countExtensions(
  dirPath: string,
  extensions: string[],
  maxDepth = 3
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ext of extensions) {
    counts[ext] = 0;
  }

  const targetExts = new Set(extensions.map((e) => (e.startsWith('.') ? e : `.${e}`)));

  findFiles(
    dirPath,
    (filename) => {
      const ext = path.extname(filename).toLowerCase();
      if (targetExts.has(ext)) {
        counts[ext] = (counts[ext] || 0) + 1;
      }
      return false;
    },
    { maxDepth }
  );

  return counts;
}

/**
 * Resolves a path relative to the repository root safely, preventing directory traversal.
 * Throws or returns null if the path attempts to break outside the repository root.
 */
export function safeResolvePath(rootPath: string, relativeOrSubPath: string): string | null {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(resolvedRoot, relativeOrSubPath);
  
  // Guard against path traversal outside rootPath
  const rel = path.relative(resolvedRoot, resolvedTarget);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  return resolvedTarget;
}

/**
 * Safely checks if a file exists within repository boundaries.
 */
export function safeFileExists(rootPath: string, relativePath: string): boolean {
  const resolved = safeResolvePath(rootPath, relativePath);
  if (!resolved) return false;
  return isFile(resolved);
}

/**
 * Safely checks if a directory exists within repository boundaries.
 */
export function safeDirectoryExists(rootPath: string, relativePath: string): boolean {
  const resolved = safeResolvePath(rootPath, relativePath);
  if (!resolved) return false;
  return isDirectory(resolved);
}

/**
 * Safely reads a text file within repository boundaries.
 */
export function safeReadTextFile(
  rootPath: string,
  relativePath: string,
  maxSizeBytes = MAX_READ_FILE_SIZE_BYTES
): string | null {
  const resolved = safeResolvePath(rootPath, relativePath);
  if (!resolved) return null;
  return readTextFile(resolved, maxSizeBytes);
}

/**
 * Safely lists relative file paths in a directory within repository boundaries.
 */
export function safeListFiles(rootPath: string, relativeDir = '', maxDepth = 5): string[] {
  const resolvedDir = safeResolvePath(rootPath, relativeDir);
  if (!resolvedDir || !isDirectory(resolvedDir)) return [];

  return findFiles(resolvedDir, () => true, {
    maxDepth,
    baseDir: resolvedDir,
  });
}

