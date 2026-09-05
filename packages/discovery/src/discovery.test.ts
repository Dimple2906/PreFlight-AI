import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { ProjectInspector } from './inspector.js';

describe('ProjectInspector', () => {
  const inspector = new ProjectInspector();
  const fixturesRoot = path.resolve(process.cwd(), 'tests/fixtures');

  it('should inspect Next.js fixture files cleanly', async () => {
    const discovered = await inspector.inspect(path.join(fixturesRoot, 'nextjs-app'));
    expect(discovered.manifests).toContain('package.json');
    expect(discovered.dbConfigFiles).toContain('prisma/schema.prisma');
    expect(discovered.configFiles).toContain('vercel.json');
  });

  it('should inspect Docker fixture files cleanly', async () => {
    const discovered = await inspector.inspect(path.join(fixturesRoot, 'docker-app'));
    expect(discovered.hasDockerfile).toBe(true);
    expect(discovered.dockerFiles).toContain('Dockerfile');
  });
});
