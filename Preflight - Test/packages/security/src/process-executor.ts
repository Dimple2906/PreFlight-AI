import { execa, ExecaError } from 'execa';
import { ExecutionPolicyGuard } from './execution-guard.js';
import { PathSecurityGuard } from './path-guard.js';
import { SecretSanitizer } from './sanitizer.js';

export interface ProcessExecutionOptions {
  command: string;
  cwd: string;
  timeoutMs?: number;
  maxBufferMb?: number;
  environment?: Record<string, string>;
  sanitizer?: SecretSanitizer;
}

export interface ProcessExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
}

export class ProcessExecutor {
  private static readonly GUARD = new ExecutionPolicyGuard();
  private static readonly MAX_DEFAULT_BUFFER = 5 * 1024 * 1024; // 5MB limit
  private static readonly SENSITIVE_ENV_KEYS = [
    'AWS_SECRET_ACCESS_KEY',
    'AWS_ACCESS_KEY_ID',
    'GITHUB_TOKEN',
    'GH_TOKEN',
    'GEMINI_API_KEY',
    'OPENAI_API_KEY',
    'DATABASE_URL',
    'JWT_SECRET',
    'SECRET_KEY'
  ];

  public static async execute(options: ProcessExecutionOptions): Promise<ProcessExecutionResult> {
    const startTime = Date.now();
    const sanitizer = options.sanitizer || new SecretSanitizer();

    // 1. Validate command policy
    ProcessExecutor.GUARD.validateCommand(options.command);

    // 2. Validate working directory path security
    const safeCwd = PathSecurityGuard.validatePath(options.cwd, options.cwd);

    // 3. Prepare sanitized child process environment (strip parent secrets)
    const childEnv = { ...process.env, ...options.environment };
    for (const key of ProcessExecutor.SENSITIVE_ENV_KEYS) {
      if (!options.environment || !(key in options.environment)) {
        delete childEnv[key];
      }
    }

    const timeout = Math.min(options.timeoutMs || 30000, 60000);
    const maxBuffer = (options.maxBufferMb || 5) * 1024 * 1024;

    const parts = options.command.split(' ');
    const binary = parts[0];
    const args = parts.slice(1);

    let stdout = '';
    let stderr = '';
    let exitCode: number | null = 0;
    let timedOut = false;

    try {
      const res = await execa(binary, args, {
        cwd: safeCwd,
        reject: false,
        timeout,
        maxBuffer,
        env: childEnv as Record<string, string>
      });

      stdout = res.stdout;
      stderr = res.stderr;
      exitCode = res.exitCode ?? null;
      timedOut = res.timedOut ?? false;
    } catch (err: any) {
      if (err.timedOut) {
        timedOut = true;
        exitCode = 124; // Timeout exit code
        stderr = `[Process Timeout] Command failed to complete within ${timeout}ms.`;
      } else if (err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
        exitCode = 1;
        stderr = `[Security Output Limit Exceeded] Process output exceeded maximum permitted buffer limit (${options.maxBufferMb || 5}MB).`;
      } else {
        exitCode = err.exitCode ?? 1;
        stderr = err.message || String(err);
      }
    }

    const durationMs = Date.now() - startTime;
    const sanitizedStdout = sanitizer.sanitize(stdout).sanitizedText;
    const sanitizedStderr = sanitizer.sanitize(stderr).sanitizedText;

    return {
      stdout: sanitizedStdout,
      stderr: sanitizedStderr,
      exitCode,
      durationMs,
      timedOut
    };
  }
}
