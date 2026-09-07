import * as path from 'path';
import { isFile, readTextFile, factHasFile, factReadTextFile } from '../../utils/filesystem';
import { PackageMetadata } from '../../utils/package';
import { RuntimeDetection, SupportedRuntime, ProjectFacts } from '../../types';

export function detectRuntime(
  projectRoot: string,
  packageMetadata: PackageMetadata,
  projectFacts?: ProjectFacts
): RuntimeDetection {
  const evidence: string[] = [];
  const pkg = packageMetadata.raw;

  const checkFile = (relativeFilePath: string): boolean => {
    if (projectFacts) {
      return factHasFile(projectFacts, relativeFilePath);
    }
    return isFile(path.join(projectRoot, relativeFilePath));
  };

  const getFileContent = (relativeFilePath: string): string | null => {
    if (projectFacts) {
      return factReadTextFile(projectFacts, relativeFilePath);
    }
    return readTextFile(path.join(projectRoot, relativeFilePath));
  };

  let name: SupportedRuntime = 'Unknown';
  let version = 'UNKNOWN';
  let packageManagerRequirement: string | undefined;

  // 1. Check for Bun signals
  const hasBunLock = checkFile('bun.lock') || checkFile('bun.lockb');
  const hasBunFig = checkFile('bunfig.toml');
  const hasBunTypes = Boolean(pkg?.devDependencies?.['@types/bun']);

  // 2. Check for Deno signals
  const hasDenoJson = checkFile('deno.json') || checkFile('deno.jsonc');

  // 3. Node.js signals
  const hasNodeVersionFile = checkFile('.node-version');
  const hasNvmrc = checkFile('.nvmrc');
  const hasEnginesNode = Boolean(pkg?.engines && pkg.engines.node);

  if (hasDenoJson) {
    name = 'Deno';
    evidence.push('deno.json configuration file detected');
  } else if (hasBunLock || hasBunFig) {
    name = 'Bun';
    if (hasBunLock) evidence.push('bun.lock/bun.lockb detected');
    if (hasBunFig) evidence.push('bunfig.toml detected');
  } else if (packageMetadata.hasPackageJson || hasEnginesNode || hasNvmrc || hasNodeVersionFile || hasBunTypes) {
    name = 'Node.js';
    evidence.push('Node.js project indicators present');
  }

  // Version extraction
  if (hasEnginesNode && pkg?.engines?.node) {
    version = pkg.engines.node;
    evidence.push(`Node engine specified in package.json engines.node: "${version}"`);
  } else if (hasNvmrc) {
    const nvmContent = getFileContent('.nvmrc');
    if (nvmContent && nvmContent.trim()) {
      version = nvmContent.trim();
      evidence.push(`Node version in .nvmrc: "${version}"`);
    }
  } else if (hasNodeVersionFile) {
    const nvContent = getFileContent('.node-version');
    if (nvContent && nvContent.trim()) {
      version = nvContent.trim();
      evidence.push(`Node version in .node-version: "${version}"`);
    }
  }

  // Check packageManager field in package.json (e.g. Corepack requirement "pnpm@8.5.0")
  if (pkg?.packageManager) {
    packageManagerRequirement = pkg.packageManager;
    evidence.push(`packageManager field in package.json specifies "${pkg.packageManager}"`);
  }

  if (name === 'Unknown' && evidence.length === 0) {
    evidence.push('No runtime configuration or package.json indicators found');
  }

  return {
    name,
    version,
    packageManagerRequirement,
    evidence,
  };
}

