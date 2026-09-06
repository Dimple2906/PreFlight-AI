import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface TempProject {
  rootPath: string;
  cleanup: () => void;
}

function makeTempDir(prefix = 'preflight-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(rootDir: string, relPath: string, content: string): void {
  const fullPath = path.join(rootDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

export function createTempNodeProject(customPackageJson?: Record<string, any>): TempProject {
  const dir = makeTempDir('node-api-');
  const pkg = {
    name: 'temp-node-api',
    version: '1.0.0',
    type: 'module',
    scripts: {
      build: 'node -e "console.log(\'build ok\')"',
      test: 'node -e "console.log(\'tests pass\')"',
      typecheck: 'node -e "console.log(\'typecheck ok\')"'
    },
    dependencies: {
      express: '^4.19.2',
      dotenv: '^16.4.5'
    },
    devDependencies: {
      '@types/express': '^4.17.21'
    },
    ...customPackageJson
  };

  writeFile(dir, 'package.json', JSON.stringify(pkg, null, 2));
  writeFile(dir, 'package-lock.json', JSON.stringify({ name: pkg.name, lockfileVersion: 3 }, null, 2));
  writeFile(dir, '.env.example', 'PORT=3000\nNODE_ENV=development\n');
  writeFile(dir, '.gitignore', 'node_modules\n.env\n');
  writeFile(dir, 'src/index.js', `
    import express from 'express';
    const app = express();
    app.use(express.json());
    app.get('/health', (req, res) => res.json({ status: 'ok' }));
    export default app;
  `);

  return {
    rootPath: dir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        // ignore
      }
    }
  };
}

export function createTempNextProject(): TempProject {
  const dir = makeTempDir('nextjs-app-');
  const pkg = {
    name: 'temp-nextjs-app',
    version: '1.0.0',
    scripts: {
      build: 'node -e "console.log(\'next build ok\')"',
      test: 'node -e "console.log(\'next tests pass\')"'
    },
    dependencies: {
      next: '^14.2.5',
      react: '^18.3.1',
      'react-dom': '^18.3.1'
    }
  };

  writeFile(dir, 'package.json', JSON.stringify(pkg, null, 2));
  writeFile(dir, 'package-lock.json', JSON.stringify({ name: pkg.name, lockfileVersion: 3 }, null, 2));
  writeFile(dir, 'next.config.js', 'module.exports = { reactStrictMode: true };\n');
  writeFile(dir, '.env.example', 'NEXT_PUBLIC_API_URL=https://api.example.com\n');
  writeFile(dir, '.gitignore', 'node_modules\n.next\n.env\n');
  writeFile(dir, 'src/pages/index.js', 'export default function Home() { return <h1>Home</h1>; }\n');
  writeFile(dir, 'src/pages/api/health.js', 'export default function handler(req, res) { res.status(200).json({ ok: true }); }\n');

  return {
    rootPath: dir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        // ignore
      }
    }
  };
}

export function createTempPythonProject(): TempProject {
  const dir = makeTempDir('python-fastapi-');
  writeFile(dir, 'requirements.txt', 'fastapi==0.111.0\nuvicorn==0.30.1\npydantic==2.7.4\n');
  writeFile(dir, '.env.example', 'APP_ENV=development\n');
  writeFile(dir, '.gitignore', '__pycache__\n.env\n*.pyc\n');
  writeFile(dir, 'src/main.py', `
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}
  `);

  return {
    rootPath: dir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        // ignore
      }
    }
  };
}

export function createTempSpringProject(): TempProject {
  const dir = makeTempDir('java-spring-');
  const pomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>temp-spring-app</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.0</version>
    </parent>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
    </dependencies>
</project>`;

  writeFile(dir, 'pom.xml', pomXml);
  writeFile(dir, '.env.example', 'SPRING_PROFILES_ACTIVE=dev\n');
  writeFile(dir, '.gitignore', 'target/\n.env\n');
  writeFile(dir, 'src/main/java/com/example/Application.java', 'package com.example; public class Application {}');

  return {
    rootPath: dir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        // ignore
      }
    }
  };
}

export function createTempStaticProject(): TempProject {
  const dir = makeTempDir('static-vite-');
  const pkg = {
    name: 'temp-static-vite',
    version: '1.0.0',
    scripts: {
      build: 'node -e "console.log(\'vite build ok\')"'
    },
    dependencies: {
      react: '^18.3.1',
      'react-dom': '^18.3.1'
    },
    devDependencies: {
      vite: '^5.3.4',
      typescript: '^5.3.3'
    }
  };

  writeFile(dir, 'package.json', JSON.stringify(pkg, null, 2));
  writeFile(dir, 'package-lock.json', JSON.stringify({ name: pkg.name, lockfileVersion: 3 }, null, 2));
  writeFile(dir, 'tsconfig.json', '{"compilerOptions": {"target": "ESNext"}}\n');
  writeFile(dir, 'vite.config.ts', 'export default {};\n');
  writeFile(dir, '.env.example', 'VITE_API_URL=https://api.example.com\n');
  writeFile(dir, '.gitignore', 'node_modules\ndist\n');
  writeFile(dir, 'src/App.tsx', 'export function App() { return <div>Hello</div>; }');

  return {
    rootPath: dir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        // ignore
      }
    }
  };
}

export function createTempDockerProject(): TempProject {
  const dir = makeTempDir('docker-app-');
  const pkg = {
    name: 'temp-docker-app',
    version: '1.0.0',
    dependencies: {
      express: '^4.19.2'
    }
  };

  writeFile(dir, 'package.json', JSON.stringify(pkg, null, 2));
  writeFile(dir, 'package-lock.json', JSON.stringify({ name: pkg.name, lockfileVersion: 3 }, null, 2));
  writeFile(dir, 'Dockerfile', 'FROM node:18-alpine\nWORKDIR /app\nCOPY . .\nCMD ["node", "index.js"]\n');
  writeFile(dir, 'docker-compose.yml', 'version: "3.8"\nservices:\n  web:\n    build: .\n    ports:\n      - "3000:3000"\n');
  writeFile(dir, '.env.example', 'PORT=3000\n');
  writeFile(dir, '.gitignore', 'node_modules\n');
  writeFile(dir, 'src/index.js', 'console.log("Docker app running");');

  return {
    rootPath: dir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        // ignore
      }
    }
  };
}

export function createTempBrokenDeploymentProject(): TempProject {
  const dir = makeTempDir('broken-deployment-');
  const pkg = {
    name: 'temp-broken-deployment',
    version: '1.0.0',
    scripts: {
      build: 'node -e "process.exit(1)"',
      test: 'node -e "process.exit(1)"'
    },
    dependencies: {
      express: '^4.19.2'
    }
  };

  writeFile(dir, 'package.json', JSON.stringify(pkg, null, 2));
  writeFile(dir, '.env', 'DATABASE_PASSWORD=productionSuperSecret99!\nAWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n');
  writeFile(dir, 'src/config.js', `
    export const OPENAI_API_KEY = "sk-proj-abc1234567890123456789012345678901234567890123456789";
    export const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";
  `);

  return {
    rootPath: dir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        // ignore
      }
    }
  };
}

export function createTempCommittedEnvProject(): TempProject {
  const dir = makeTempDir('committed-env-');
  const pkg = {
    name: 'temp-committed-env',
    version: '1.0.0',
    dependencies: { express: '^4.19.2' }
  };
  writeFile(dir, 'package.json', JSON.stringify(pkg, null, 2));
  writeFile(dir, 'package-lock.json', JSON.stringify({ name: pkg.name, lockfileVersion: 3 }, null, 2));
  writeFile(dir, '.env', 'SECRET_TOKEN=my_secret_token_12345\n');
  writeFile(dir, '.env.example', 'SECRET_TOKEN=your_token_here\n');
  writeFile(dir, 'src/index.js', 'console.log("running");');

  return {
    rootPath: dir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        // ignore
      }
    }
  };
}

export function createTempExposedSecretProject(): TempProject {
  const dir = makeTempDir('exposed-secret-');
  const pkg = {
    name: 'temp-exposed-secret',
    version: '1.0.0',
    dependencies: { express: '^4.19.2' }
  };
  writeFile(dir, 'package.json', JSON.stringify(pkg, null, 2));
  writeFile(dir, 'package-lock.json', JSON.stringify({ name: pkg.name, lockfileVersion: 3 }, null, 2));
  writeFile(dir, '.env.example', 'API_KEY=sample\n');
  writeFile(dir, '.gitignore', 'node_modules\n.env\n');
  writeFile(dir, 'src/secrets.js', `
    const awsKey = "AKIAIOSFODNN7EXAMPLE";
    const secret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
    console.log(awsKey);
  `);

  return {
    rootPath: dir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        // ignore
      }
    }
  };
}

export function createTempVulnerableProject(options: { buildFails?: boolean } = { buildFails: true }): TempProject {
  const dir = makeTempDir('vulnerable-api-');
  const pkg = {
    name: 'temp-vulnerable-api',
    version: '1.0.0',
    scripts: {
      build: options.buildFails !== false ? 'node -e "process.exit(1)"' : 'node -e "console.log(\'build ok\')"',
      test: 'node -e "console.error(\'Adversarial security test failed: unauthenticated access\'); process.exit(1)"'
    },
    dependencies: {
      express: '^4.19.2',
      pg: '^8.12.0',
      jsonwebtoken: '^9.0.2'
    }
  };

  writeFile(dir, 'package.json', JSON.stringify(pkg, null, 2));
  writeFile(dir, 'package-lock.json', JSON.stringify({ name: pkg.name, lockfileVersion: 3 }, null, 2));
  writeFile(dir, '.env', 'DATABASE_PASSWORD=productionSuperSecret99!\n');
  writeFile(dir, '.env.example', 'DATABASE_URL=postgres://user:pass@localhost:5432/db\n');
  writeFile(dir, '.gitignore', 'node_modules\n');
  writeFile(dir, 'src/server.js', `
    import express from 'express';
    const app = express();
    app.get('/api/admin/users', (req, res) => res.json({ users: [] }));
    app.post('/api/search', (req, res) => res.json({ result: "raw sql" }));
    export default app;
  `);

  return {
    rootPath: dir,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        // ignore
      }
    }
  };
}
