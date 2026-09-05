import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { ProjectInspector } from '@preflight/discovery';
import { ProjectClassifier } from './classifier.js';

describe('ProjectClassifier with Test Fixtures', () => {
  const inspector = new ProjectInspector();
  const classifier = new ProjectClassifier();
  const fixturesRoot = path.resolve(process.cwd(), 'tests/fixtures');

  it('should correctly classify Next.js + Prisma + Vercel fixture', async () => {
    const discovered = await inspector.inspect(path.join(fixturesRoot, 'nextjs-app'));
    const profile = classifier.classify(discovered);

    expect(profile.frameworks).toContain('nextjs');
    expect(profile.databases).toContain('postgresql');
    expect(profile.hosting).toContain('vercel');
    expect(profile.projectType).toBe('fullstack');
    expect(profile.evidenceList.some(e => e.value === 'Next.js' && e.confidence === 'HIGH')).toBe(true);
    expect(profile.evidenceList.some(e => e.value === 'PostgreSQL' && e.confidence === 'HIGH')).toBe(true);
  });

  it('should correctly classify Express + PG + Stripe fixture with domain signals', async () => {
    const discovered = await inspector.inspect(path.join(fixturesRoot, 'express-api'));
    const profile = classifier.classify(discovered);

    expect(profile.frameworks).toContain('express');
    expect(profile.databases).toContain('postgresql');
    expect(profile.domainSignals).toContain('payments');
    expect(profile.domainSignals).toContain('auth');
    expect(profile.projectType).toBe('api-server');
  });

  it('should correctly classify React + Vite frontend fixture', async () => {
    const discovered = await inspector.inspect(path.join(fixturesRoot, 'react-frontend'));
    const profile = classifier.classify(discovered);

    expect(profile.frameworks).toContain('react');
    expect(profile.languages).toContain('javascript');
  });

  it('should correctly classify Fastify + Redis Node API fixture', async () => {
    const discovered = await inspector.inspect(path.join(fixturesRoot, 'node-api'));
    const profile = classifier.classify(discovered);

    expect(profile.frameworks).toContain('fastify');
    expect(profile.databases).toContain('redis');
    expect(profile.projectType).toBe('api-server');
  });

  it('should correctly classify Docker containerized app fixture', async () => {
    const discovered = await inspector.inspect(path.join(fixturesRoot, 'docker-app'));
    const profile = classifier.classify(discovered);

    expect(profile.hasDockerfile).toBe(true);
    expect(profile.hosting).toContain('docker');
    expect(profile.evidenceList.some(e => e.value === 'Docker' && e.confidence === 'HIGH')).toBe(true);
  });
});
