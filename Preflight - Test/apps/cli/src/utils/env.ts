import dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Loads environment variables from candidate .env files in priority order:
 * 1. Target project path (.env, .env.local)
 * 2. Current working directory (.env, .env.local)
 * 3. User home directory (~/.preflight/.env, ~/.env)
 *
 * Existing process.env variables are NEVER overwritten.
 */
export function loadCliEnvironment(targetPath?: string): void {
  const candidateFiles: string[] = [];

  if (targetPath) {
    candidateFiles.push(path.resolve(targetPath, '.env'));
    candidateFiles.push(path.resolve(targetPath, '.env.local'));
  }

  candidateFiles.push(path.resolve(process.cwd(), '.env'));
  candidateFiles.push(path.resolve(process.cwd(), '.env.local'));

  try {
    const home = os.homedir();
    candidateFiles.push(path.join(home, '.preflight', '.env'));
    candidateFiles.push(path.join(home, '.env'));
  } catch {
    // ignore
  }

  for (const envFile of candidateFiles) {
    if (fs.existsSync(envFile)) {
      try {
        dotenv.config({ path: envFile, override: false });
      } catch {
        // ignore unreadable/malformed env files
      }
    }
  }
}
