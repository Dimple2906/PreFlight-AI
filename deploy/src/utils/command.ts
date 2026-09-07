import { spawn } from 'child_process';
import { sanitizeOutput } from './sanitize';

export interface CommandOptions {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs?: number;
  env?: Record<string, string>;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  error?: string;
}

/**
 * Executes a program directly using spawn/execFile semantics without shell parsing.
 * Captures stdout, stderr, exit code, duration, and enforces strict timeout.
 * Automatically sanitizes secrets from stdout and stderr.
 */
export async function executeCommand(options: CommandOptions): Promise<CommandResult> {
  const { command, args, cwd, timeoutMs = 10000, env } = options;
  const startTime = Date.now();

  return new Promise<CommandResult>((resolve) => {
    let stdoutData = '';
    let stderrData = '';
    let timedOut = false;
    let finished = false;

    // Use spawn safely. On Windows, npm/pnpm/yarn/npx are cmd/bat scripts and require cmd.exe invocation.
    const isWindows = process.platform === 'win32';
    const isWindowsBatch = isWindows && (['npm', 'pnpm', 'yarn', 'npx', 'bun'].includes(command) || command.endsWith('.cmd') || command.endsWith('.bat'));
    
    const spawnExecutable = isWindowsBatch ? 'cmd.exe' : command;
    const spawnArgs = isWindowsBatch ? ['/d', '/s', '/c', [command, ...args].join(' ')] : args;

    const child = spawn(spawnExecutable, spawnArgs, {
      cwd,
      env: { ...process.env, ...env },
      shell: false,
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {}
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      resolve({
        stdout: sanitizeOutput(stdoutData),
        stderr: sanitizeOutput(stderrData + '\n' + err.message),
        exitCode: -1,
        durationMs,
        timedOut,
        error: err.message,
      });
    });

    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      resolve({
        stdout: sanitizeOutput(stdoutData),
        stderr: sanitizeOutput(stderrData),
        exitCode: code,
        durationMs,
        timedOut,
      });
    });
  });
}
