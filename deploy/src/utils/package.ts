import * as path from 'path';
import { readTextFile, isFile } from './filesystem';

export interface ParsedPackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  main?: string;
  module?: string;
  types?: string;
  typings?: string;
  bin?: string | Record<string, string>;
  exports?: any;
  workspaces?: string[] | { packages?: string[] };
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  packageManager?: string;
  [key: string]: any;
}

export interface PackageMetadata {
  raw: ParsedPackageJson | null;
  hasPackageJson: boolean;
  isValid: boolean;
  isMalformed: boolean;
  filePath: string;
}

/**
 * Safely load and parse package.json from a project directory or direct file path.
 * Returns a PackageMetadata object with flags indicating whether it is valid or malformed.
 */
export function readPackageJson(targetDirOrFile: string): PackageMetadata {
  const filePath = targetDirOrFile.endsWith('package.json')
    ? targetDirOrFile
    : path.join(targetDirOrFile, 'package.json');

  if (!isFile(filePath)) {
    return {
      raw: null,
      hasPackageJson: false,
      isValid: false,
      isMalformed: false,
      filePath,
    };
  }

  const content = readTextFile(filePath);
  if (!content || !content.trim()) {
    return {
      raw: null,
      hasPackageJson: true,
      isValid: false,
      isMalformed: true,
      filePath,
    };
  }

  try {
    const parsed = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        raw: null,
        hasPackageJson: true,
        isValid: false,
        isMalformed: true,
        filePath,
      };
    }
    return {
      raw: parsed,
      hasPackageJson: true,
      isValid: true,
      isMalformed: false,
      filePath,
    };
  } catch {
    return {
      raw: null,
      hasPackageJson: true,
      isValid: false,
      isMalformed: true,
      filePath,
    };
  }
}

/**
 * Check if a specific package is listed in dependencies, devDependencies, or peerDependencies.
 */
export function hasDependency(
  pkg: ParsedPackageJson | null | undefined,
  packageName: string
): { found: boolean; version?: string; section?: 'dependencies' | 'devDependencies' | 'peerDependencies' } {
  if (!pkg) return { found: false };

  if (pkg.dependencies && pkg.dependencies[packageName]) {
    return { found: true, version: pkg.dependencies[packageName], section: 'dependencies' };
  }
  if (pkg.devDependencies && pkg.devDependencies[packageName]) {
    return { found: true, version: pkg.devDependencies[packageName], section: 'devDependencies' };
  }
  if (pkg.peerDependencies && pkg.peerDependencies[packageName]) {
    return { found: true, version: pkg.peerDependencies[packageName], section: 'peerDependencies' };
  }

  return { found: false };
}

/**
 * Check if any package in the list exists in package.json.
 */
export function hasAnyDependency(
  pkg: ParsedPackageJson | null | undefined,
  packageNames: string[]
): { found: boolean; name?: string; version?: string; section?: string } {
  for (const name of packageNames) {
    const result = hasDependency(pkg, name);
    if (result.found) {
      return { found: true, name, version: result.version, section: result.section };
    }
  }
  return { found: false };
}

/**
 * Checks if a specific script exists in scripts.
 */
export function hasScript(pkg: ParsedPackageJson | null | undefined, scriptName: string): boolean {
  return Boolean(pkg?.scripts && typeof pkg.scripts[scriptName] === 'string');
}

/**
 * Extracts normalized workspace glob patterns from package.json or pnpm-workspace.yaml.
 */
export function extractWorkspacePatterns(
  pkg: ParsedPackageJson | null | undefined,
  pnpmWorkspaceYamlContent?: string | null
): string[] {
  const patterns = new Set<string>();

  // 1. package.json workspaces (array or object { packages: [...] })
  if (pkg?.workspaces) {
    if (Array.isArray(pkg.workspaces)) {
      for (const pattern of pkg.workspaces) {
        if (typeof pattern === 'string' && pattern.trim()) {
          patterns.add(pattern.trim().replace(/\\/g, '/'));
        }
      }
    } else if (typeof pkg.workspaces === 'object' && Array.isArray(pkg.workspaces.packages)) {
      for (const pattern of pkg.workspaces.packages) {
        if (typeof pattern === 'string' && pattern.trim()) {
          patterns.add(pattern.trim().replace(/\\/g, '/'));
        }
      }
    }
  }

  // 2. pnpm-workspace.yaml packages list parsing (simple YAML line parser without heavy dependencies)
  if (pnpmWorkspaceYamlContent) {
    const lines = pnpmWorkspaceYamlContent.split(/\r?\n/);
    let inPackagesSection = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (trimmed === 'packages:' || trimmed.startsWith('packages:')) {
        inPackagesSection = true;
        continue;
      }

      if (inPackagesSection) {
        // If line is indented item, e.g. "- 'packages/*'" or "- apps/**"
        const itemMatch = trimmed.match(/^-\s*['"]?([^'"]+)['"]?/);
        if (itemMatch) {
          patterns.add(itemMatch[1].trim().replace(/\\/g, '/'));
        } else if (/^[a-zA-Z0-9_-]+:/.test(trimmed)) {
          // Started another YAML section
          inPackagesSection = false;
        }
      }
    }
  }

  return Array.from(patterns);
}

/**
 * Tests if a relative directory path matches a workspace glob pattern.
 * Supports patterns like:
 * - "apps/*"
 * - "packages/*"
 * - "services/* /api" (without space)
 * - "modules/** /sub"
 * - "apps/web"
 */
export function matchesWorkspacePattern(relativeDirPath: string, pattern: string): boolean {
  const cleanDir = relativeDirPath.replace(/\\/g, '/').replace(/^\//, '').replace(/\/$/, '');
  const cleanPattern = pattern.replace(/\\/g, '/').replace(/^\//, '').replace(/\/$/, '');

  // Exact match
  if (cleanDir === cleanPattern) return true;

  // Segment by segment glob matching
  const patternSegments = cleanPattern.split('/');
  const dirSegments = cleanDir.split('/');

  // If pattern ends with /**, it matches everything below
  if (cleanPattern.endsWith('/**')) {
    const base = cleanPattern.slice(0, -3);
    return cleanDir.startsWith(base + '/') || cleanDir === base;
  }

  // Segment count check if no **
  if (!cleanPattern.includes('**')) {
    if (patternSegments.length !== dirSegments.length) return false;
    for (let i = 0; i < patternSegments.length; i++) {
      const pSeg = patternSegments[i];
      const dSeg = dirSegments[i];
      if (pSeg === '*') continue;
      if (pSeg !== dSeg) return false;
    }
    return true;
  }

  // Fallback for complex patterns with **
  const regexString = '^' + cleanPattern
    .split('/')
    .map((seg) => {
      if (seg === '**') return '.*';
      if (seg === '*') return '[^/]+';
      return seg.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    })
    .join('/') + '$';

  try {
    const regex = new RegExp(regexString);
    return regex.test(cleanDir);
  } catch {
    return false;
  }
}

