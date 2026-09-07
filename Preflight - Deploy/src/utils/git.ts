import { executeCommand, CommandResult } from './command';

export interface GitInspectionResult {
  isGitRepo: boolean;
  uncommittedFiles: string[];
  trackedFiles: string[];
  ignoredFiles: string[];
  headSha?: string;
  error?: string;
}

/**
 * Executes controlled Git inspection commands strictly without shell pipelines.
 */
export async function inspectGit(repoRoot: string, timeoutMs = 5000): Promise<GitInspectionResult> {
  // 1. Check if inside git work tree
  const revParse = await executeCommand({
    command: 'git',
    args: ['rev-parse', '--is-inside-work-tree'],
    cwd: repoRoot,
    timeoutMs,
  });

  if (revParse.exitCode !== 0 || !revParse.stdout.trim().includes('true')) {
    return {
      isGitRepo: false,
      uncommittedFiles: [],
      trackedFiles: [],
      ignoredFiles: [],
      error: revParse.stderr || 'Not a git repository',
    };
  }

  // 2. Get HEAD commit SHA
  const revHead = await executeCommand({
    command: 'git',
    args: ['rev-parse', 'HEAD'],
    cwd: repoRoot,
    timeoutMs,
  });
  const headSha = revHead.exitCode === 0 ? revHead.stdout.trim() : undefined;

  // 3. Check status --porcelain
  const statusRes = await executeCommand({
    command: 'git',
    args: ['status', '--porcelain'],
    cwd: repoRoot,
    timeoutMs,
  });

  const uncommittedFiles: string[] = [];
  if (statusRes.exitCode === 0 && statusRes.stdout.trim()) {
    const lines = statusRes.stdout.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        // Line format: XY <path> or XY <path> -> <path>
        const filePath = line.slice(3).trim();
        uncommittedFiles.push(filePath);
      }
    }
  }

  // 4. List all tracked files
  const lsFilesRes = await executeCommand({
    command: 'git',
    args: ['ls-files'],
    cwd: repoRoot,
    timeoutMs,
  });

  const trackedFiles: string[] = [];
  if (lsFilesRes.exitCode === 0 && lsFilesRes.stdout.trim()) {
    const lines = lsFilesRes.stdout.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        trackedFiles.push(line.trim().replace(/\\/g, '/'));
      }
    }
  }

  return {
    isGitRepo: true,
    uncommittedFiles,
    trackedFiles,
    ignoredFiles: [],
    headSha,
  };
}

/**
 * Checks if specific files are ignored by git rules.
 */
export async function checkGitIgnore(repoRoot: string, filePaths: string[], timeoutMs = 5000): Promise<string[]> {
  if (filePaths.length === 0) return [];
  const res = await executeCommand({
    command: 'git',
    args: ['check-ignore', ...filePaths],
    cwd: repoRoot,
    timeoutMs,
  });

  if (res.exitCode === 0 && res.stdout.trim()) {
    return res.stdout.split('\n').map((l) => l.trim().replace(/\\/g, '/')).filter(Boolean);
  }
  return [];
}
