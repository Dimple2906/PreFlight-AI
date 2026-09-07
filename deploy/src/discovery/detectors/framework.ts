import * as path from 'path';
import { isFile, factHasFile } from '../../utils/filesystem';
import { PackageMetadata, hasDependency } from '../../utils/package';
import { FrameworkDetection, FrameworkItem, SupportedFramework, ProjectFacts } from '../../types';

interface FrameworkRule {
  name: SupportedFramework;
  dependencies: string[];
  configFiles: string[];
  sourceSignatures?: (projectRoot: string) => boolean;
}

const FRAMEWORK_RULES: FrameworkRule[] = [
  {
    name: 'Next.js',
    dependencies: ['next'],
    configFiles: [
      'next.config.js',
      'next.config.mjs',
      'next.config.ts',
      'next.config.cjs',
    ],
  },
  {
    name: 'Remix',
    dependencies: ['@remix-run/node', '@remix-run/react', '@remix-run/serve'],
    configFiles: ['remix.config.js', 'remix.config.ts', 'remix.config.mjs'],
  },
  {
    name: 'Nuxt',
    dependencies: ['nuxt', 'nuxt3'],
    configFiles: ['nuxt.config.js', 'nuxt.config.ts', 'nuxt.config.mjs'],
  },
  {
    name: 'NestJS',
    dependencies: ['@nestjs/core', '@nestjs/common'],
    configFiles: ['nest-cli.json'],
  },
  {
    name: 'Fastify',
    dependencies: ['fastify'],
    configFiles: [],
  },
  {
    name: 'Express',
    dependencies: ['express'],
    configFiles: [],
  },
  {
    name: 'Vite',
    dependencies: ['vite'],
    configFiles: [
      'vite.config.js',
      'vite.config.ts',
      'vite.config.mjs',
      'vite.config.cjs',
    ],
  },
  {
    name: 'React',
    dependencies: ['react', 'react-dom'],
    configFiles: [],
  },
];

/**
 * Detect frameworks present in a project root.
 * Consumes shared ProjectFacts when available for fast cached O(1) checks.
 */
export function detectFrameworks(
  projectRoot: string,
  packageMetadata: PackageMetadata,
  projectFacts?: ProjectFacts
): FrameworkDetection {
  const detectedFrameworks: FrameworkItem[] = [];
  const pkg = packageMetadata.raw;

  const checkFile = (relativeFilePath: string): boolean => {
    if (projectFacts) {
      return factHasFile(projectFacts, relativeFilePath);
    }
    return isFile(path.join(projectRoot, relativeFilePath));
  };

  for (const rule of FRAMEWORK_RULES) {
    const evidence: string[] = [];
    let hasDep = false;
    let depVersion: string | undefined;

    // 1. Dependency check
    for (const dep of rule.dependencies) {
      const match = hasDependency(pkg, dep);
      if (match.found) {
        hasDep = true;
        depVersion = match.version;
        evidence.push(`Dependency "${dep}" (${match.version || 'unversioned'}) found in ${match.section}`);
      }
    }

    // 2. Configuration file check
    let hasConfig = false;
    for (const configFile of rule.configFiles) {
      if (checkFile(configFile)) {
        hasConfig = true;
        evidence.push(`Configuration file "${configFile}" found at project root`);
      }
    }

    // 3. Custom source pattern checks (if applicable)
    if (rule.sourceSignatures && rule.sourceSignatures(projectRoot)) {
      evidence.push(`Matching source code signature found for ${rule.name}`);
    }

    // Determine confidence
    if (hasDep && hasConfig) {
      detectedFrameworks.push({
        name: rule.name,
        confidence: 'DETECTED',
        version: depVersion,
        evidence,
      });
    } else if (hasDep) {
      const confidence = 'DETECTED';
      detectedFrameworks.push({
        name: rule.name,
        confidence,
        version: depVersion,
        evidence,
      });
    } else if (hasConfig) {
      // Config exists but dependency not yet installed
      detectedFrameworks.push({
        name: rule.name,
        confidence: 'LIKELY',
        evidence,
      });
    }
  }

  if (detectedFrameworks.length === 0) {
    return {
      frameworks: [
        {
          name: 'Unknown',
          confidence: 'UNKNOWN',
          evidence: ['No recognized framework dependencies or configuration files found'],
        },
      ],
    };
  }

  return { frameworks: detectedFrameworks };
}

