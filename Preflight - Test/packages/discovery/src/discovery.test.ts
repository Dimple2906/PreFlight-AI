import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProjectInspector } from './inspector.js';
import { createTempNextProject, createTempDockerProject, TempProject } from '@preflight/core';

describe('ProjectInspector (Dynamic Temporary Projects)', () => {
  const inspector = new ProjectInspector();
  let tempProj: TempProject | null = null;

  afterEach(() => {
    if (tempProj) {
      tempProj.cleanup();
      tempProj = null;
    }
  });

  it('should inspect dynamic Next.js project files cleanly', async () => {
    tempProj = createTempNextProject();
    // Add prisma and vercel config dynamically
    fs.mkdirSync(path.join(tempProj.rootPath, 'prisma'), { recursive: true });
    fs.writeFileSync(path.join(tempProj.rootPath, 'prisma/schema.prisma'), 'datasource db { provider = "postgresql" }');
    fs.writeFileSync(path.join(tempProj.rootPath, 'vercel.json'), '{"buildCommand": "next build"}');

    const discovered = await inspector.inspect(tempProj.rootPath);
    expect(discovered.manifests).toContain('package.json');
    expect(discovered.dbConfigFiles).toContain('prisma/schema.prisma');
    expect(discovered.configFiles).toContain('vercel.json');
  });

  it('should inspect dynamic Docker project files cleanly', async () => {
    tempProj = createTempDockerProject();
    const discovered = await inspector.inspect(tempProj.rootPath);
    expect(discovered.hasDockerfile).toBe(true);
    expect(discovered.dockerFiles).toContain('Dockerfile');
  });
});
