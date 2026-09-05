import { LogLevel } from '@preflight/core';

export interface GlobalCliOptions {
  json: boolean;
  verbose: boolean;
  quiet: boolean;
  ai: boolean;
  config?: string;
  report?: string;
}

export function parseLogLevel(options: GlobalCliOptions): LogLevel {
  if (options.quiet) return 'silent';
  if (options.verbose) return 'verbose';
  return 'normal';
}
