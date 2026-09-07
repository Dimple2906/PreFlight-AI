import * as path from 'path';
import { isDirectory, isFile, factHasDirectory, factHasFile } from '../../utils/filesystem';
import { PackageMetadata, hasDependency } from '../../utils/package';
import { ProjectType, ProjectTypeDetection, FrameworkItem, ProjectFacts } from '../../types';

export function detectProjectType(
  projectRoot: string,
  packageMetadata: PackageMetadata,
  frameworks: FrameworkItem[],
  projectFacts?: ProjectFacts
): ProjectTypeDetection {
  const pkg = packageMetadata.raw;
  const evidence: string[] = [];
  const candidateScores: Map<ProjectType, number> = new Map([
    ['CLI', 0],
    ['library', 0],
    ['API/backend', 0],
    ['web application', 0],
    ['worker', 0],
    ['static frontend', 0],
  ]);

  const addScore = (type: ProjectType, points: number, reason: string) => {
    candidateScores.set(type, (candidateScores.get(type) || 0) + points);
    evidence.push(`[${type}] ${reason}`);
  };

  const checkFile = (relativeFilePath: string): boolean => {
    if (projectFacts) {
      return factHasFile(projectFacts, relativeFilePath);
    }
    return isFile(path.join(projectRoot, relativeFilePath));
  };

  const checkDirectory = (relativeDirPath: string): boolean => {
    if (projectFacts) {
      return factHasDirectory(projectFacts, relativeDirPath);
    }
    return isDirectory(path.join(projectRoot, relativeDirPath));
  };

  // 1. CLI indicators
  if (pkg?.bin) {
    addScore('CLI', 50, `package.json specifies "bin" field (${JSON.stringify(pkg.bin)})`);
  }
  if (checkDirectory('bin')) {
    addScore('CLI', 20, 'Directory "bin" exists');
  }

  // 2. Library indicators
  let libraryPoints = 0;
  if (pkg?.main) libraryPoints += 10;
  if (pkg?.module) libraryPoints += 10;
  if (pkg?.types || pkg?.typings) libraryPoints += 15;
  if (pkg?.exports) libraryPoints += 15;
  if (libraryPoints > 0 && !pkg?.private) libraryPoints += 10;
  if (libraryPoints >= 25) {
    addScore('library', libraryPoints, 'package.json specifies library entrypoints (main/module/types/exports)');
  }

  // 3. Worker indicators (background queue workers, cron jobs, bullmq/kafka/amqp)
  const workerDeps = ['bullmq', 'bull', 'agenda', 'kafkajs', 'amqplib', 'cron', 'node-cron', 'temporalio'];
  for (const wDep of workerDeps) {
    if (hasDependency(pkg, wDep).found) {
      addScore('worker', 35, `Queue/Job/Messaging dependency "${wDep}" found`);
    }
  }
  if (checkFile('worker.js') || checkFile('worker.ts') || checkFile('src/worker.ts') || checkDirectory('workers')) {
    addScore('worker', 30, 'Worker entrypoint or workers/ directory found');
  }

  // 4. Framework hints
  const frameworkNames = new Set(frameworks.map((f) => f.name));

  if (frameworkNames.has('Next.js') || frameworkNames.has('Remix') || frameworkNames.has('Nuxt')) {
    addScore('web application', 40, `Full-stack framework "${Array.from(frameworkNames).join(', ')}" detected`);
    addScore('API/backend', 20, 'Full-stack framework supports API routes and server execution');
  }

  if (frameworkNames.has('Express') || frameworkNames.has('NestJS') || frameworkNames.has('Fastify')) {
    addScore('API/backend', 40, `Backend framework "${Array.from(frameworkNames).join(', ')}" detected`);
  }

  if (frameworkNames.has('React') || frameworkNames.has('Vite')) {
    if (!frameworkNames.has('Next.js') && !frameworkNames.has('Remix')) {
      addScore('web application', 25, 'Frontend framework/bundler detected');
    }
  }

  // 5. Directory structure analysis
  if (checkDirectory('app') || checkDirectory('src/app')) {
    addScore('web application', 15, 'App directory (Next.js App Router / web application structure) exists');
  }

  if (checkDirectory('pages') || checkDirectory('src/pages')) {
    addScore('web application', 15, 'Pages directory exists');
  }

  if (
    checkDirectory('routes') ||
    checkDirectory('src/routes') ||
    checkDirectory('controllers') ||
    checkDirectory('src/controllers') ||
    checkFile('server.js') ||
    checkFile('server.ts') ||
    checkFile('src/server.ts') ||
    checkFile('src/server.js')
  ) {
    addScore('API/backend', 25, 'Backend route/controller files or server entrypoint detected');
  }

  if (checkFile('index.html')) {
    if (!frameworkNames.has('Express') && !frameworkNames.has('NestJS') && !frameworkNames.has('Fastify')) {
      addScore('static frontend', 20, 'Root index.html present without backend server');
    }
  }

  // Sort candidate types by score
  const sorted = Array.from(candidateScores.entries())
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) {
    return {
      primaryType: 'unknown',
      secondaryTypes: [],
      confidence: 'UNKNOWN',
      evidence: ['Insufficient signals to determine project type'],
    };
  }

  const primaryType = sorted[0][0];
  const primaryScore = sorted[0][1];

  // Secondary types must have significant scores (at least 20 points) and not be the primary
  const secondaryTypes: ProjectType[] = sorted
    .slice(1)
    .filter(([_, score]) => score >= 20)
    .map(([type]) => type);

  const confidence = primaryScore >= 30 ? 'DETECTED' : 'LIKELY';

  return {
    primaryType,
    secondaryTypes,
    confidence,
    evidence,
  };
}

