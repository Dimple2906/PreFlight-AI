import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProjectInspector } from '@preflight/discovery';
import { ProjectClassifier } from './classifier.js';
import {
  createTempNextProject,
  createTempNodeProject,
  createTempStaticProject,
  createTempDockerProject,
  TempProject
} from '@preflight/core';

describe('ProjectClassifier (Dynamic Temporary Projects)', () => {
  const inspector = new ProjectInspector();
  const classifier = new ProjectClassifier();
  let tempProjs: TempProject[] = [];

  afterEach(() => {
    for (const p of tempProjs) {
      p.cleanup();
    }
    tempProjs = [];
  });

  it('should correctly classify Next.js + Prisma + Vercel dynamic project', async () => {
    const proj = createTempNextProject();
    tempProjs.push(proj);

    fs.mkdirSync(path.join(proj.rootPath, 'prisma'), { recursive: true });
    fs.writeFileSync(path.join(proj.rootPath, 'prisma/schema.prisma'), 'datasource db { provider = "postgresql" }');
    fs.writeFileSync(path.join(proj.rootPath, 'vercel.json'), '{"buildCommand": "next build"}');

    const discovered = await inspector.inspect(proj.rootPath);
    const profile = classifier.classify(discovered);

    expect(profile.frameworks).toContain('nextjs');
    expect(profile.databases).toContain('postgresql');
    expect(profile.hosting).toContain('vercel');
    expect(profile.projectType).toBe('fullstack');
    expect(profile.evidenceList.some(e => e.value === 'Next.js' && e.confidence === 'HIGH')).toBe(true);
    expect(profile.evidenceList.some(e => e.value === 'PostgreSQL' && e.confidence === 'HIGH')).toBe(true);
  });

  it('should correctly classify Express + PG + Stripe dynamic project with domain signals', async () => {
    const proj = createTempNodeProject({
      dependencies: {
        express: '^4.19.2',
        pg: '^8.12.0',
        stripe: '^16.2.0',
        jsonwebtoken: '^9.0.2'
      }
    });
    tempProjs.push(proj);

    const discovered = await inspector.inspect(proj.rootPath);
    const profile = classifier.classify(discovered);

    expect(profile.frameworks).toContain('express');
    expect(profile.databases).toContain('postgresql');
    expect(profile.domainSignals).toContain('payments');
    expect(profile.domainSignals).toContain('auth');
    expect(profile.projectType).toBe('api-server');
  });

  it('should correctly classify React + Vite frontend dynamic project', async () => {
    const proj = createTempStaticProject();
    tempProjs.push(proj);

    const discovered = await inspector.inspect(proj.rootPath);
    const profile = classifier.classify(discovered);

    expect(profile.frameworks).toContain('react');
    expect(profile.languages).toContain('typescript');
  });

  it('should correctly classify Fastify + Redis Node API dynamic project', async () => {
    const proj = createTempNodeProject({
      dependencies: {
        fastify: '^4.28.1',
        ioredis: '^5.4.1'
      }
    });
    tempProjs.push(proj);

    const discovered = await inspector.inspect(proj.rootPath);
    const profile = classifier.classify(discovered);

    expect(profile.frameworks).toContain('fastify');
    expect(profile.databases).toContain('redis');
    expect(profile.projectType).toBe('api-server');
  });

  it('should correctly classify Docker containerized app dynamic project', async () => {
    const proj = createTempDockerProject();
    tempProjs.push(proj);

    const discovered = await inspector.inspect(proj.rootPath);
    const profile = classifier.classify(discovered);

    expect(profile.hasDockerfile).toBe(true);
    expect(profile.hosting).toContain('docker');
    expect(profile.evidenceList.some(e => e.value === 'Docker' && e.confidence === 'HIGH')).toBe(true);
  });
});
