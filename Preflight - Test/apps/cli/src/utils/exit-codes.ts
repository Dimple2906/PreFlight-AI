import { PreflightError, ConfigurationError } from '@preflight/core';

export enum ExitCode {
  SUCCESS = 0,
  FAILURE = 1,
  INVALID_USAGE = 2,
  SYSTEM_ERROR = 3,
  INTERRUPTED = 130
}

export function resolveExitCode(err?: unknown): ExitCode {
  if (!err) return ExitCode.SUCCESS;

  if (err instanceof ConfigurationError) {
    return ExitCode.INVALID_USAGE;
  }

  if (err instanceof PreflightError) {
    return ExitCode.SYSTEM_ERROR;
  }

  return ExitCode.SYSTEM_ERROR;
}
