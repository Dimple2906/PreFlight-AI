import * as fs from 'node:fs';
import * as path from 'node:path';
import { FrameworkDetector, DetectionResult } from './detector.interface.js';
import { DiscoveredProjectFiles } from '../inspector.js';

export class NextDetector implements FrameworkDetector {
  readonly name = 'Next.js Detector';
  readonly framework = 'nextjs';

  async detect(discovered: DiscoveredProjectFiles, rootPath: string, dependencies: Record<string, string>): Promise<DetectionResult | null> {
    if (dependencies['next'] || fs.existsSync(path.join(rootPath, 'next.config.js')) || fs.existsSync(path.join(rootPath, 'next.config.mjs')) || fs.existsSync(path.join(rootPath, 'next.config.ts'))) {
      return {
        framework: 'nextjs',
        evidence: {
          feature: 'framework',
          value: 'Next.js',
          confidence: 'HIGH',
          sourceFile: dependencies['next'] ? 'package.json' : 'next.config.js',
          reason: 'Next.js dependency or configuration file detected.'
        }
      };
    }
    return null;
  }
}

export class ReactDetector implements FrameworkDetector {
  readonly name = 'React Detector';
  readonly framework = 'react';

  async detect(discovered: DiscoveredProjectFiles, rootPath: string, dependencies: Record<string, string>): Promise<DetectionResult | null> {
    if (dependencies['react'] && !dependencies['next'] && !dependencies['@remix-run/react']) {
      return {
        framework: 'react',
        evidence: {
          feature: 'framework',
          value: 'React',
          confidence: 'HIGH',
          sourceFile: 'package.json',
          reason: 'React UI library dependency present.'
        }
      };
    }
    return null;
  }
}

export class ExpressDetector implements FrameworkDetector {
  readonly name = 'Express Detector';
  readonly framework = 'express';

  async detect(discovered: DiscoveredProjectFiles, rootPath: string, dependencies: Record<string, string>): Promise<DetectionResult | null> {
    if (dependencies['express']) {
      return {
        framework: 'express',
        evidence: {
          feature: 'framework',
          value: 'Express',
          confidence: 'HIGH',
          sourceFile: 'package.json',
          reason: 'Express API framework dependency present.'
        }
      };
    }
    return null;
  }
}

export class FastifyDetector implements FrameworkDetector {
  readonly name = 'Fastify Detector';
  readonly framework = 'fastify';

  async detect(discovered: DiscoveredProjectFiles, rootPath: string, dependencies: Record<string, string>): Promise<DetectionResult | null> {
    if (dependencies['fastify']) {
      return {
        framework: 'fastify',
        evidence: {
          feature: 'framework',
          value: 'Fastify',
          confidence: 'HIGH',
          sourceFile: 'package.json',
          reason: 'Fastify server framework dependency present.'
        }
      };
    }
    return null;
  }
}

export class NestDetector implements FrameworkDetector {
  readonly name = 'NestJS Detector';
  readonly framework = 'nest';

  async detect(discovered: DiscoveredProjectFiles, rootPath: string, dependencies: Record<string, string>): Promise<DetectionResult | null> {
    if (dependencies['@nestjs/core']) {
      return {
        framework: 'nest',
        evidence: {
          feature: 'framework',
          value: 'NestJS',
          confidence: 'HIGH',
          sourceFile: 'package.json',
          reason: 'NestJS framework core dependency present.'
        }
      };
    }
    return null;
  }
}

export class ViteDetector implements FrameworkDetector {
  readonly name = 'Vite Detector';
  readonly framework = 'vite';

  async detect(discovered: DiscoveredProjectFiles, rootPath: string, dependencies: Record<string, string>): Promise<DetectionResult | null> {
    if (dependencies['vite'] || fs.existsSync(path.join(rootPath, 'vite.config.ts')) || fs.existsSync(path.join(rootPath, 'vite.config.js'))) {
      return {
        framework: 'vite',
        evidence: {
          feature: 'framework',
          value: 'Vite',
          confidence: 'HIGH',
          sourceFile: fs.existsSync(path.join(rootPath, 'vite.config.ts')) ? 'vite.config.ts' : 'package.json',
          reason: 'Vite build tool dependency or configuration file present.'
        }
      };
    }
    return null;
  }
}

export class FastAPIDetector implements FrameworkDetector {
  readonly name = 'FastAPI Detector';
  readonly framework = 'fastapi';

  async detect(discovered: DiscoveredProjectFiles, rootPath: string, dependencies: Record<string, string>): Promise<DetectionResult | null> {
    const reqPath = path.join(rootPath, 'requirements.txt');
    const pyprojectPath = path.join(rootPath, 'pyproject.toml');
    let found = false;

    if (fs.existsSync(reqPath)) {
      const content = fs.readFileSync(reqPath, 'utf-8').toLowerCase();
      if (content.includes('fastapi')) found = true;
    }
    if (!found && fs.existsSync(pyprojectPath)) {
      const content = fs.readFileSync(pyprojectPath, 'utf-8').toLowerCase();
      if (content.includes('fastapi')) found = true;
    }

    if (found) {
      return {
        framework: 'fastapi',
        evidence: {
          feature: 'framework',
          value: 'FastAPI',
          confidence: 'HIGH',
          sourceFile: fs.existsSync(reqPath) ? 'requirements.txt' : 'pyproject.toml',
          reason: 'FastAPI dependency detected in Python manifest.'
        }
      };
    }
    return null;
  }
}

export class DjangoDetector implements FrameworkDetector {
  readonly name = 'Django Detector';
  readonly framework = 'django';

  async detect(discovered: DiscoveredProjectFiles, rootPath: string, dependencies: Record<string, string>): Promise<DetectionResult | null> {
    const managePy = path.join(rootPath, 'manage.py');
    const reqPath = path.join(rootPath, 'requirements.txt');
    let found = fs.existsSync(managePy);

    if (!found && fs.existsSync(reqPath)) {
      const content = fs.readFileSync(reqPath, 'utf-8').toLowerCase();
      if (content.includes('django')) found = true;
    }

    if (found) {
      return {
        framework: 'django',
        evidence: {
          feature: 'framework',
          value: 'Django',
          confidence: 'HIGH',
          sourceFile: fs.existsSync(managePy) ? 'manage.py' : 'requirements.txt',
          reason: 'Django framework project file or dependency detected.'
        }
      };
    }
    return null;
  }
}

export class SpringBootDetector implements FrameworkDetector {
  readonly name = 'Spring Boot Detector';
  readonly framework = 'spring';

  async detect(discovered: DiscoveredProjectFiles, rootPath: string, dependencies: Record<string, string>): Promise<DetectionResult | null> {
    const pomPath = path.join(rootPath, 'pom.xml');
    const gradlePath = path.join(rootPath, 'build.gradle');
    let found = false;

    if (fs.existsSync(pomPath)) {
      const content = fs.readFileSync(pomPath, 'utf-8');
      if (content.includes('spring-boot')) found = true;
    }
    if (!found && fs.existsSync(gradlePath)) {
      const content = fs.readFileSync(gradlePath, 'utf-8');
      if (content.includes('spring-boot') || content.includes('org.springframework.boot')) found = true;
    }

    if (found) {
      return {
        framework: 'spring',
        evidence: {
          feature: 'framework',
          value: 'Spring Boot',
          confidence: 'HIGH',
          sourceFile: fs.existsSync(pomPath) ? 'pom.xml' : 'build.gradle',
          reason: 'Spring Boot framework configuration detected in Java build manifest.'
        }
      };
    }
    return null;
  }
}

export const defaultFrameworkDetectors: FrameworkDetector[] = [
  new NextDetector(),
  new ReactDetector(),
  new ExpressDetector(),
  new FastifyDetector(),
  new NestDetector(),
  new ViteDetector(),
  new FastAPIDetector(),
  new DjangoDetector(),
  new SpringBootDetector()
];
