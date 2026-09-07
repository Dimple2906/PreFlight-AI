import { CheckDefinition, CheckDomain, CheckGroup, DeploymentLayer, ApplicableCheck } from '../../types';

export interface GroupDefinition {
  id: string;
  name: string;
  layer: DeploymentLayer;
  domain: CheckDomain;
  description: string;
}

export const CHECK_GROUPS: GroupDefinition[] = [
  // Layer 1: Universal
  {
    id: 'group.universal.git',
    name: 'Version Control & Git Integrity',
    layer: 'UNIVERSAL',
    domain: 'git',
    description: 'Validates git commit status, tracking of files, and clean repository state.',
  },
  {
    id: 'group.universal.environment',
    name: 'Environment Configuration & Secret Safety',
    layer: 'UNIVERSAL',
    domain: 'environment',
    description: 'Ensures required production environment variables exist and no credentials are committed.',
  },
  {
    id: 'group.universal.dependencies',
    name: 'Dependencies & Lockfile Integrity',
    layer: 'UNIVERSAL',
    domain: 'dependencies',
    description: 'Validates reproducible lockfiles, dependencies, and package manager consistency.',
  },
  {
    id: 'group.universal.runtime',
    name: 'Runtime Specification',
    layer: 'UNIVERSAL',
    domain: 'runtime',
    description: 'Ensures execution runtime and version engines are explicitly declared.',
  },
  {
    id: 'group.universal.build',
    name: 'Build Configuration & Outputs',
    layer: 'UNIVERSAL',
    domain: 'build',
    description: 'Validates build commands, scripts, and production distribution artifact paths.',
  },

  // Layer 2: Project Type
  {
    id: 'group.project_type.web',
    name: 'Web Application Readiness',
    layer: 'PROJECT_TYPE',
    domain: 'web',
    description: 'Port binding, start script, health routes, and static asset handling for web apps.',
  },
  {
    id: 'group.project_type.api',
    name: 'API & Backend Service',
    layer: 'PROJECT_TYPE',
    domain: 'api',
    description: 'Host binding, CORS configuration, graceful shutdown, and endpoint health.',
  },
  {
    id: 'group.project_type.cli',
    name: 'CLI Tool & Executable',
    layer: 'PROJECT_TYPE',
    domain: 'cli',
    description: 'Binary entrypoint permissions, shebang, and npm packaging.',
  },
  {
    id: 'group.project_type.library',
    name: 'Library & Package Distribution',
    layer: 'PROJECT_TYPE',
    domain: 'library',
    description: 'Entrypoint exports, TypeScript definitions, and publish whitelists.',
  },
  {
    id: 'group.project_type.worker',
    name: 'Background Worker & Job Processing',
    layer: 'PROJECT_TYPE',
    domain: 'worker',
    description: 'Worker lifecycle, queue connections, and shutdown idempotency.',
  },
  {
    id: 'group.project_type.static',
    name: 'Static Site Export',
    layer: 'PROJECT_TYPE',
    domain: 'static',
    description: 'Static export distribution directory and SPA client routing fallbacks.',
  },
  {
    id: 'group.project_type.desktop',
    name: 'Desktop Application Packaging',
    layer: 'PROJECT_TYPE',
    domain: 'desktop',
    description: 'Electron / Tauri packaging bundles, codesigning, and platform targets.',
  },

  // Layer 3: Technology
  {
    id: 'group.tech.runtime',
    name: 'Runtime & Language Specifics',
    layer: 'TECHNOLOGY',
    domain: 'runtime',
    description: 'Engine versions and runtime-specific dependency handling (Node, Python, etc.).',
  },
  {
    id: 'group.tech.framework',
    name: 'Framework Architecture & Bundling',
    layer: 'TECHNOLOGY',
    domain: 'framework',
    description: 'Framework-specific build steps, output formats, and public variable prefixing.',
  },
  {
    id: 'group.tech.database',
    name: 'Database Engine Connectivity',
    layer: 'TECHNOLOGY',
    domain: 'database',
    description: 'Database connection strings, SSL modes, and connection pool configurations.',
  },
  {
    id: 'group.tech.orm',
    name: 'ORM & Schema Management',
    layer: 'TECHNOLOGY',
    domain: 'orm',
    description: 'Prisma, Drizzle, or Mongoose schema compilation and production migration commands.',
  },
  {
    id: 'group.tech.cache',
    name: 'Cache & Memory Store',
    layer: 'TECHNOLOGY',
    domain: 'cache',
    description: 'Redis/memcached connection parameters and retry handling.',
  },
  {
    id: 'group.tech.package_manager',
    name: 'Package Manager Deployment Modes',
    layer: 'TECHNOLOGY',
    domain: 'package-manager',
    description: 'Deterministic CI installation flags (npm ci, pnpm frozen lockfile).',
  },

  // Layer 4: Deployment Target
  {
    id: 'group.target.hosting',
    name: 'Target Hosting Platform Configuration',
    layer: 'DEPLOYMENT_TARGET',
    domain: 'hosting',
    description: 'Target platform descriptor files (Vercel, Netlify, Docker, Railway, Render, Fly.io, AWS).',
  },

  // Layer 5: Infrastructure & Monorepo
  {
    id: 'group.infra.infrastructure',
    name: 'CI/CD Pipelines & Workflows',
    layer: 'INFRASTRUCTURE',
    domain: 'infrastructure',
    description: 'GitHub Actions, GitLab CI workflows, and pipeline credential handling.',
  },
  {
    id: 'group.infra.monorepo',
    name: 'Monorepo Workspace Orchestration',
    layer: 'INFRASTRUCTURE',
    domain: 'monorepo',
    description: 'Topological workspace builds and preventing dangling local symlinks in production.',
  },
];

/**
 * Organizes a list of applicable checks into groups based on their layer and domain.
 */
export function groupChecks(applicableChecks: ApplicableCheck[]): CheckGroup[] {
  const groupMap = new Map<string, CheckGroup>();

  for (const item of applicableChecks) {
    const key = `${item.check.layer}::${item.check.domain}`;
    if (!groupMap.has(key)) {
      const def = CHECK_GROUPS.find(
        (g) => g.layer === item.check.layer && g.domain === item.check.domain
      );

      groupMap.set(key, {
        id: def ? def.id : `group.${item.check.layer.toLowerCase()}.${item.check.domain}`,
        name: def ? def.name : `${item.check.layer} - ${item.check.domain}`,
        layer: item.check.layer,
        domain: item.check.domain,
        checks: [],
      });
    }

    groupMap.get(key)!.checks.push(item);
  }

  return Array.from(groupMap.values());
}
