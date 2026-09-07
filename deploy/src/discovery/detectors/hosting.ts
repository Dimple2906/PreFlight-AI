import * as path from 'path';
import { isFile, factHasFile } from '../../utils/filesystem';
import { PackageMetadata } from '../../utils/package';
import { HostingDetection, HostingItem, SupportedHosting, ProjectFacts } from '../../types';

interface HostingRule {
  name: SupportedHosting;
  configFiles: string[];
}

const HOSTING_RULES: HostingRule[] = [
  {
    name: 'Vercel',
    configFiles: ['vercel.json', '.vercel'],
  },
  {
    name: 'Netlify',
    configFiles: ['netlify.toml', '_redirects', '_headers'],
  },
  {
    name: 'Docker',
    configFiles: [
      'Dockerfile',
      'docker-compose.yml',
      'docker-compose.yaml',
      'compose.yaml',
      'compose.yml',
      '.dockerignore',
    ],
  },
  {
    name: 'Railway',
    configFiles: ['railway.json', 'railway.toml', 'Procfile'],
  },
  {
    name: 'Render',
    configFiles: ['render.yaml', 'render.yml'],
  },
  {
    name: 'Fly.io',
    configFiles: ['fly.toml'],
  },
  {
    name: 'AWS',
    configFiles: ['serverless.yml', 'serverless.yaml', 'sst.config.ts', 'cdk.json'],
  },
];

/**
 * Detect hosting configurations based strictly on explicit configuration files.
 * Critical rule: Does NOT infer hosting from frameworks (e.g. Next.js does NOT automatically mean Vercel).
 */
export function detectHosting(
  projectRoot: string,
  _packageMetadata?: PackageMetadata,
  projectFacts?: ProjectFacts
): HostingDetection {
  const detected: HostingItem[] = [];

  const checkFile = (relativeFilePath: string): boolean => {
    if (projectFacts) {
      return factHasFile(projectFacts, relativeFilePath);
    }
    return isFile(path.join(projectRoot, relativeFilePath));
  };

  for (const rule of HOSTING_RULES) {
    const evidence: string[] = [];
    let matchedFile: string | undefined;

    for (const configFile of rule.configFiles) {
      if (checkFile(configFile)) {
        matchedFile = configFile;
        evidence.push(`Hosting configuration file "${configFile}" found at project root`);
      }
    }

    if (evidence.length > 0) {
      detected.push({
        name: rule.name,
        confidence: 'DETECTED',
        configFile: matchedFile,
        evidence,
      });
    }
  }

  if (detected.length === 0) {
    return {
      hosting: [
        {
          name: 'Unknown',
          confidence: 'UNKNOWN',
          evidence: ['No explicit hosting or deployment configuration files found'],
        },
      ],
    };
  }

  return { hosting: detected };
}

