import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ProjectProfile,
  ProjectProfileSchema,
  ProjectLanguage,
  Framework,
  Database,
  Architecture,
  ProjectType,
  HostingProvider,
  DetectionEvidence,
  DomainSignal
} from '@preflight/core';
import { DiscoveredProjectFiles, defaultFrameworkDetectors } from '@preflight/discovery';

export class ProjectClassifier {
  public async classifyAsync(discovered: DiscoveredProjectFiles): Promise<ProjectProfile> {
    return this.classify(discovered);
  }

  public classify(discovered: DiscoveredProjectFiles): ProjectProfile {
    let name = path.basename(discovered.rootPath);
    let dependencies: Record<string, string> = {};
    let devDependencies: Record<string, string> = {};
    const languages: Set<ProjectLanguage> = new Set();
    const frameworks: Set<Framework> = new Set();
    const databases: Set<Database> = new Set();
    const hosting: Set<HostingProvider> = new Set();
    const domainSignals: Set<DomainSignal> = new Set();
    const evidenceList: DetectionEvidence[] = [];

    const manifestSource = discovered.packageJsonPath ? 'package.json' : 'manifest';

    if (discovered.packageJsonPath && fs.existsSync(discovered.packageJsonPath)) {
      try {
        const raw = fs.readFileSync(discovered.packageJsonPath, 'utf-8');
        const pkg = JSON.parse(raw);
        if (pkg.name) name = pkg.name;
        dependencies = pkg.dependencies || {};
        devDependencies = pkg.devDependencies || {};
      } catch (err) {
        // Fallback safely
      }
    }

    const allDeps = { ...dependencies, ...devDependencies };

    // 1. Language Detection
    if (discovered.manifests.includes('package.json')) {
      if (allDeps['typescript'] || fs.existsSync(path.join(discovered.rootPath, 'tsconfig.json'))) {
        languages.add('typescript');
        evidenceList.push({
          feature: 'language',
          value: 'TypeScript',
          confidence: 'HIGH',
          sourceFile: fs.existsSync(path.join(discovered.rootPath, 'tsconfig.json')) ? 'tsconfig.json' : 'package.json',
          reason: 'TypeScript dependency or tsconfig.json configuration detected.'
        });
      } else {
        languages.add('javascript');
        evidenceList.push({
          feature: 'language',
          value: 'JavaScript',
          confidence: 'HIGH',
          sourceFile: 'package.json',
          reason: 'Node.js package manifest present without TypeScript.'
        });
      }
    }

    if (discovered.manifests.some(m => m.endsWith('.py') || m.toLowerCase().includes('python') || m === 'requirements.txt' || m === 'pyproject.toml')) {
      languages.add('python');
      evidenceList.push({
        feature: 'language',
        value: 'Python',
        confidence: 'HIGH',
        sourceFile: discovered.manifests.find(m => m.endsWith('.py') || m === 'requirements.txt' || m === 'pyproject.toml') || 'requirements.txt',
        reason: 'Python package manifest or source files detected.'
      });
    }

    if (discovered.manifests.some(m => m === 'pom.xml' || m === 'build.gradle')) {
      languages.add('java');
      evidenceList.push({
        feature: 'language',
        value: 'Java',
        confidence: 'HIGH',
        sourceFile: discovered.manifests.find(m => m === 'pom.xml' || m === 'build.gradle') || 'pom.xml',
        reason: 'Java Maven or Gradle build manifest detected.'
      });
    }

    if (discovered.manifests.includes('go.mod')) {
      languages.add('go');
      evidenceList.push({
        feature: 'language',
        value: 'Go',
        confidence: 'HIGH',
        sourceFile: 'go.mod',
        reason: 'Go module manifest detected.'
      });
    }

    if (languages.size === 0) languages.add('unknown');

    // 2. Framework Detection via Modular Detectors & Direct Dep Check
    for (const detector of defaultFrameworkDetectors) {
      // Synchronous probe fallback for basic dependencies
      if (detector.framework === 'nextjs' && (allDeps['next'] || fs.existsSync(path.join(discovered.rootPath, 'next.config.js')))) {
        frameworks.add('nextjs');
        evidenceList.push({
          feature: 'framework',
          value: 'Next.js',
          confidence: 'HIGH',
          sourceFile: allDeps['next'] ? manifestSource : 'next.config.js',
          reason: 'Next.js dependency or configuration file present.'
        });
      } else if (detector.framework === 'react' && allDeps['react'] && !allDeps['next']) {
        frameworks.add('react');
        evidenceList.push({
          feature: 'framework',
          value: 'React',
          confidence: 'HIGH',
          sourceFile: manifestSource,
          reason: 'React UI library dependency present.'
        });
      } else if (detector.framework === 'express' && allDeps['express']) {
        frameworks.add('express');
        evidenceList.push({
          feature: 'framework',
          value: 'Express',
          confidence: 'HIGH',
          sourceFile: manifestSource,
          reason: 'Express API framework dependency present.'
        });
      } else if (detector.framework === 'fastify' && allDeps['fastify']) {
        frameworks.add('fastify');
        evidenceList.push({
          feature: 'framework',
          value: 'Fastify',
          confidence: 'HIGH',
          sourceFile: manifestSource,
          reason: 'Fastify server framework dependency present.'
        });
      } else if (detector.framework === 'nest' && allDeps['@nestjs/core']) {
        frameworks.add('nest');
        evidenceList.push({
          feature: 'framework',
          value: 'NestJS',
          confidence: 'HIGH',
          sourceFile: manifestSource,
          reason: 'NestJS framework core dependency present.'
        });
      } else if (detector.framework === 'vite' && (allDeps['vite'] || fs.existsSync(path.join(discovered.rootPath, 'vite.config.ts')))) {
        frameworks.add('vite');
        evidenceList.push({
          feature: 'framework',
          value: 'Vite',
          confidence: 'HIGH',
          sourceFile: fs.existsSync(path.join(discovered.rootPath, 'vite.config.ts')) ? 'vite.config.ts' : manifestSource,
          reason: 'Vite build tool dependency or configuration file present.'
        });
      } else if (detector.framework === 'fastapi') {
        const reqPath = path.join(discovered.rootPath, 'requirements.txt');
        if (fs.existsSync(reqPath) && fs.readFileSync(reqPath, 'utf-8').toLowerCase().includes('fastapi')) {
          frameworks.add('fastapi');
          evidenceList.push({
            feature: 'framework',
            value: 'FastAPI',
            confidence: 'HIGH',
            sourceFile: 'requirements.txt',
            reason: 'FastAPI framework dependency detected in requirements.txt.'
          });
        }
      } else if (detector.framework === 'django') {
        if (fs.existsSync(path.join(discovered.rootPath, 'manage.py'))) {
          frameworks.add('django');
          evidenceList.push({
            feature: 'framework',
            value: 'Django',
            confidence: 'HIGH',
            sourceFile: 'manage.py',
            reason: 'Django manage.py file detected.'
          });
        }
      } else if (detector.framework === 'spring') {
        const pomPath = path.join(discovered.rootPath, 'pom.xml');
        if (fs.existsSync(pomPath) && fs.readFileSync(pomPath, 'utf-8').includes('spring-boot')) {
          frameworks.add('spring');
          evidenceList.push({
            feature: 'framework',
            value: 'Spring Boot',
            confidence: 'HIGH',
            sourceFile: 'pom.xml',
            reason: 'Spring Boot dependency detected in pom.xml.'
          });
        }
      }
    }

    if (frameworks.size === 0) frameworks.add('unknown');

    // 3. Database Detection
    if (discovered.dbConfigFiles.includes('prisma/schema.prisma') || allDeps['@prisma/client']) {
      databases.add('postgresql');
      evidenceList.push({
        feature: 'database',
        value: 'PostgreSQL',
        confidence: 'HIGH',
        sourceFile: discovered.dbConfigFiles.includes('prisma/schema.prisma') ? 'prisma/schema.prisma' : manifestSource,
        reason: 'Prisma ORM schema or client detected.'
      });
      domainSignals.add('databases');
    }
    if (allDeps['pg']) {
      databases.add('postgresql');
      evidenceList.push({
        feature: 'database',
        value: 'PostgreSQL',
        confidence: 'HIGH',
        sourceFile: manifestSource,
        reason: 'node-postgres (pg) database driver dependency detected.'
      });
      domainSignals.add('databases');
    }
    if (allDeps['mysql'] || allDeps['mysql2']) {
      databases.add('mysql');
      evidenceList.push({
        feature: 'database',
        value: 'MySQL',
        confidence: 'HIGH',
        sourceFile: manifestSource,
        reason: 'MySQL database driver dependency detected.'
      });
      domainSignals.add('databases');
    }
    if (allDeps['mongodb'] || allDeps['mongoose']) {
      databases.add('mongodb');
      evidenceList.push({
        feature: 'database',
        value: 'MongoDB',
        confidence: 'HIGH',
        sourceFile: manifestSource,
        reason: 'MongoDB driver or Mongoose ORM dependency detected.'
      });
      domainSignals.add('databases');
    }
    if (allDeps['redis'] || allDeps['ioredis']) {
      databases.add('redis');
      evidenceList.push({
        feature: 'database',
        value: 'Redis',
        confidence: 'HIGH',
        sourceFile: manifestSource,
        reason: 'Redis in-memory store client dependency detected.'
      });
      domainSignals.add('databases');
    }
    if (allDeps['sqlite3'] || allDeps['better-sqlite3']) {
      databases.add('sqlite');
      evidenceList.push({
        feature: 'database',
        value: 'SQLite',
        confidence: 'HIGH',
        sourceFile: manifestSource,
        reason: 'SQLite database driver dependency detected.'
      });
      domainSignals.add('databases');
    }
    if (databases.size === 0) databases.add('none');

    // 4. Hosting Detection
    if (fs.existsSync(path.join(discovered.rootPath, 'vercel.json')) || frameworks.has('nextjs')) {
      hosting.add('vercel');
      evidenceList.push({
        feature: 'hosting',
        value: 'Vercel',
        confidence: 'HIGH',
        sourceFile: fs.existsSync(path.join(discovered.rootPath, 'vercel.json')) ? 'vercel.json' : manifestSource,
        reason: 'Vercel configuration or Next.js deployment marker detected.'
      });
    }
    if (discovered.hasDockerfile) {
      hosting.add('docker');
      evidenceList.push({
        feature: 'hosting',
        value: 'Docker',
        confidence: 'HIGH',
        sourceFile: discovered.dockerFiles[0] || 'Dockerfile',
        reason: 'Dockerfile or Docker Compose configuration detected.'
      });
    }
    if (hosting.size === 0) hosting.add('unknown');

    // 5. Package Manager Detection
    let packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'pip' | 'poetry' | 'maven' | 'gradle' | 'cargo' | 'go' | 'unknown' = 'npm';
    if (discovered.lockFiles.includes('pnpm-lock.yaml')) {
      packageManager = 'pnpm';
    } else if (discovered.lockFiles.includes('yarn.lock')) {
      packageManager = 'yarn';
    } else if (discovered.lockFiles.includes('bun.lockb')) {
      packageManager = 'bun';
    } else if (discovered.manifests.includes('requirements.txt')) {
      packageManager = 'pip';
    } else if (discovered.manifests.includes('pom.xml')) {
      packageManager = 'maven';
    } else if (discovered.manifests.includes('build.gradle')) {
      packageManager = 'gradle';
    } else if (discovered.manifests.includes('go.mod')) {
      packageManager = 'go';
    }

    // 6. Domain Signals Detection
    if (allDeps['next-auth'] || allDeps['@auth/core'] || allDeps['passport'] || allDeps['jsonwebtoken'] || allDeps['clerk'] || allDeps['lucia']) {
      domainSignals.add('auth');
      evidenceList.push({
        feature: 'domain-signal',
        value: 'authentication',
        confidence: 'HIGH',
        sourceFile: manifestSource,
        reason: 'Authentication library dependency present.'
      });
    }
    if (allDeps['stripe'] || allDeps['@stripe/stripe-js'] || allDeps['paypal'] || allDeps['razorpay']) {
      domainSignals.add('payments');
      evidenceList.push({
        feature: 'domain-signal',
        value: 'payments',
        confidence: 'HIGH',
        sourceFile: manifestSource,
        reason: 'Payment gateway provider dependency present.'
      });
    }
    if (allDeps['multer'] || allDeps['uploadthing'] || allDeps['@aws-sdk/client-s3'] || allDeps['cloudinary']) {
      domainSignals.add('file-uploads');
      evidenceList.push({
        feature: 'domain-signal',
        value: 'file-uploads',
        confidence: 'HIGH',
        sourceFile: manifestSource,
        reason: 'File upload / storage SDK dependency present.'
      });
    }

    // 7. Project Type Inference
    let projectType: ProjectType = 'web-app';
    if (frameworks.has('express') || frameworks.has('fastify') || frameworks.has('nest') || frameworks.has('fastapi') || frameworks.has('flask') || frameworks.has('spring')) {
      projectType = 'api-server';
    } else if (frameworks.has('nextjs')) {
      projectType = 'fullstack';
    } else if (dependencies['commander'] || dependencies['yargs']) {
      projectType = 'cli-tool';
    }

    let architecture: Architecture = 'monolith';
    if (discovered.lockFiles.includes('pnpm-lock.yaml') && fs.existsSync(path.join(discovered.rootPath, 'pnpm-workspace.yaml'))) {
      architecture = 'monorepo';
    }

    const runtime = languages.has('python') ? 'python' : languages.has('java') ? 'java' : languages.has('go') ? 'go' : 'node';

    return ProjectProfileSchema.parse({
      name,
      rootPath: discovered.rootPath,
      languages: Array.from(languages),
      frameworks: Array.from(frameworks),
      runtime,
      databases: Array.from(databases),
      architecture,
      projectType,
      hosting: Array.from(hosting),
      packageManager,
      hasDockerfile: discovered.hasDockerfile,
      hasCIConfig: discovered.hasCIConfig,
      entrypoints: ['src/index.ts', 'src/main.ts', 'src/index.js', 'app.py', 'main.py'].filter(e => fs.existsSync(path.join(discovered.rootPath, e))),
      testFrameworks: ['vitest', 'jest', 'pytest'].filter(t => Boolean(allDeps[t]) || t === 'pytest'),
      envFiles: discovered.envFiles,
      dependencies,
      devDependencies,
      domainSignals: Array.from(domainSignals),
      evidenceList
    });
  }
}
