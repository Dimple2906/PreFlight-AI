import fg from 'fast-glob';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DiscoveredProjectFiles {
  rootPath: string;
  packageJsonPath?: string;
  hasDockerfile: boolean;
  dockerFiles: string[];
  hasCIConfig: boolean;
  ciFiles: string[];
  envFiles: string[];
  configFiles: string[];
  manifests: string[];
  dbConfigFiles: string[];
  lockFiles: string[];
  sourceFilesCount: number;
  sourceDirectories: string[];
}

export class ProjectInspector {
  public async inspect(targetPath: string): Promise<DiscoveredProjectFiles> {
    const absoluteRoot = path.resolve(targetPath);
    if (!fs.existsSync(absoluteRoot)) {
      throw new Error(`Target path does not exist: ${absoluteRoot}`);
    }

    const packageJsonPath = fs.existsSync(path.join(absoluteRoot, 'package.json'))
      ? path.join(absoluteRoot, 'package.json')
      : undefined;

    // Scan env file names ONLY - NEVER read secret values inside them
    const envFiles = await fg(['.env*', '!.env*.example'], { cwd: absoluteRoot, dot: true });
    
    // Scan config files
    const configFiles = await fg([
      '*.config.*',
      '.*rc*',
      'vercel.json',
      'netlify.toml',
      'docker-compose*.yml'
    ], { cwd: absoluteRoot, dot: true });

    // Scan database configuration files
    const dbConfigFiles = await fg([
      'prisma/schema.prisma',
      'drizzle.config.ts',
      'drizzle.config.js',
      'ormconfig.json',
      'knexfile.js',
      'knexfile.ts',
      'sequelize.js'
    ], { cwd: absoluteRoot });

    // Scan manifests
    const manifests = await fg([
      'package.json',
      'requirements.txt',
      'pyproject.toml',
      'Cargo.toml',
      'go.mod',
      'pom.xml'
    ], { cwd: absoluteRoot });

    // Scan lockfiles
    const lockFiles = await fg([
      'pnpm-lock.yaml',
      'package-lock.json',
      'yarn.lock',
      'bun.lockb',
      'Cargo.lock',
      'poetry.lock'
    ], { cwd: absoluteRoot });

    // Scan CI files
    const ciFiles = await fg(['.github/workflows/*.yml', '.gitlab-ci.yml', 'Jenkinsfile'], { cwd: absoluteRoot, dot: true });

    // Scan Docker files
    const dockerFiles = await fg(['Dockerfile*', 'docker-compose*.yml'], { cwd: absoluteRoot });

    // Source files count
    const sourceFiles = await fg(['src/**/*', 'lib/**/*', 'app/**/*', 'pages/**/*', 'routes/**/*'], { cwd: absoluteRoot });

    const sourceDirectories = ['src', 'lib', 'app', 'pages', 'routes'].filter(d =>
      fs.existsSync(path.join(absoluteRoot, d)) && fs.statSync(path.join(absoluteRoot, d)).isDirectory()
    );

    return {
      rootPath: absoluteRoot,
      packageJsonPath,
      hasDockerfile: dockerFiles.length > 0,
      dockerFiles,
      hasCIConfig: ciFiles.length > 0,
      ciFiles,
      envFiles,
      configFiles,
      manifests,
      dbConfigFiles,
      lockFiles,
      sourceFilesCount: sourceFiles.length,
      sourceDirectories
    };
  }
}
